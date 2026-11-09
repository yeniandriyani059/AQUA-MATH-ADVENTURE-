#!/usr/bin/env python3
"""Real PostgreSQL concurrency tests. Fresh Docker container, --network none, no ports.
Uses synthetic schema/legacy function; NEVER connects to Supabase or existing DBs.
Requires a pre-pulled postgres:16-bookworm image. No production credential needed.
"""
import concurrent.futures as futures
import json
import os
from pathlib import Path
import re
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
ENV = {k: v for k, v in os.environ.items() if k not in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH')}
DOCKER = ['docker','--host=unix:///var/run/docker.sock']
NAME = f'aqua-championship-local-{os.getpid()}'
TEACHER = '6568ffbf-91c4-4ccb-9d00-980c2ffb64fb'
TP = '99999999-9999-4999-8999-999999999999'
OTHER_TEACHER = '99999999-9999-4999-8999-999999999998'
FOREIGN_SESSION = '77777777-7777-4777-8777-777777777777'
ROSTER = re.findall(r"^  '([0-9a-f-]{36})',", (ROOT/'src/services/championshipSessions.ts').read_text(), re.M)
OWNERS = [f'00000000-0000-4000-8000-{i+1:012d}' for i in range(14)]
assert len(ROSTER) == 14
passed = 0

def docker(*args, **kwargs):
    return subprocess.run(DOCKER+list(args), env=ENV, text=True, capture_output=True, **kwargs)
def command():
    return DOCKER+['exec','-i',NAME,'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U','postgres','-d','aqua_test','-f','-']
def sql(text, who=None, role='authenticated', expect_error=None):
    prefix = f"SET request.jwt.claim.sub='{who}'; SET ROLE {role};" if who else ''
    result = subprocess.run(command(), input=prefix+text, env=ENV, text=True, capture_output=True, timeout=15)
    if expect_error:
        assert result.returncode and expect_error in result.stderr, result.stderr or result.stdout
        return result.stderr
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()
def value(text, who=None):
    return json.loads(sql(text,who))
def check(label):
    global passed
    passed += 1
    print(f'PASS PostgreSQL {passed}: {label}', flush=True)
def keyed(session, request=None, correct=9, location=1):
    request = request or str(uuid.uuid4())
    return f"public.aqua_save_championship_attempt_v1('{request}','CHAMPIONSHIP',{(location+1)//2},'{location}',{correct},{10-correct},30,'{session}')"
def legacy(session, correct=9, location=1):
    return f"public.save_game_attempt('CHAMPIONSHIP',{(location+1)//2},'{location}',{correct},{10-correct},30,'{session}')"
def open_session():
    return sql("SELECT public.aqua_open_championship_v1('Synthetic AQUA');",TEACHER)
def close(session):
    return sql(f"SELECT public.aqua_close_championship_v1('{session}');",TEACHER)
def score(session, student=ROSTER[0]):
    return int(sql(f"SELECT official_score FROM public.championship_participants WHERE session_id='{session}' AND student_id='{student}';"))
def count(session):
    return int(sql(f"SELECT count(*) FROM public.game_attempts WHERE session_id='{session}';"))
def snapshot_solo():
    return sql("SELECT jsonb_build_object('attempts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.game_attempts a WHERE mode='SOLO'),'progress',(SELECT jsonb_agg(to_jsonb(p) ORDER BY student_id) FROM public.game_progress p));")
def start(text,who,app):
    prefix=f"SET application_name='{app}';SET request.jwt.claim.sub='{who}';SET ROLE authenticated;"
    proc=subprocess.Popen(command(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=ENV)
    proc.stdin.write(prefix+text);proc.stdin.close();proc.stdin=None
    return proc

def wait_for(app, kind):
    until=time.monotonic()+8
    while time.monotonic()<until:
        n=sql(f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{app}' AND {'wait_event_type=\'Lock\'' if kind=='lock' else 'wait_event=\'PgSleep\''};")
        if int(n)>0:return
        time.sleep(.03)
    raise AssertionError(f'{app} did not reach expected {kind} wait')
def finish(proc, error=None):
    out,err=proc.communicate(timeout=12)
    if error:assert proc.returncode and error in err,err
    else:assert proc.returncode==0,err
    return out

def main():
    result=docker('run','--detach','--rm','--network','none','--name',NAME,'--label','aqua.test=championship','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=aqua_test','postgres:16-bookworm')
    assert result.returncode==0,result.stderr
    try:
        for _ in range(100):
            log=docker('logs',NAME)
            if 'PostgreSQL init process complete' in (log.stdout+log.stderr) and docker('exec',NAME,'pg_isready','-U','postgres','-d','aqua_test').returncode==0:break
            time.sleep(.1)
        else:raise AssertionError('Local PostgreSQL did not start')
        sql((ROOT/'tests/postgres/championship-fixture.sql').read_text())
        sql(f"INSERT INTO public.teacher_profiles(id,auth_user_id,role) VALUES('{TP}','{TEACHER}','teacher'),('{OTHER_TEACHER}','{OTHER_TEACHER}','teacher');")
        for i,(profile,owner) in enumerate(zip(ROSTER,OWNERS)):
            sql(f"INSERT INTO public.student_profiles(id,auth_user_id,display_name) VALUES('{profile}','{owner}','Synthetic Student {i+1}');")
        # Another app uses even the same teacher account; it must remain outside AQUA scope.
        sql(f"INSERT INTO public.championship_sessions(id,session_name,status,created_by) VALUES('{FOREIGN_SESSION}','Other application','OPEN','{TP}');INSERT INTO public.championship_participants(session_id,student_id) VALUES('{FOREIGN_SESSION}','{ROSTER[0]}');")
        for i in (0,1):
            sql(f"SELECT public.save_game_attempt('SOLO',1,'1',{8+i},{2-i},30,NULL);",OWNERS[i])
        baseline=snapshot_solo()
        policies_before=sql("SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='public' AND tablename IN ('game_attempts','game_progress');")
        original_body=sql("SELECT prosrc FROM pg_proc WHERE oid='public.save_game_attempt(text,integer,text,integer,integer,integer,uuid)'::regprocedure;")
        # Save output comparison uses rollback, so synthetic SOLO records remain untouched.
        solo_probe="BEGIN;SELECT public.save_game_attempt('SOLO',1,'1',7,3,15,NULL)-'attempt_id';ROLLBACK;"
        original_solo=value(solo_probe,OWNERS[0])
        migration=(ROOT/'docs/sql/aqua-championship.final.review.sql').read_text()
        sql(migration)
        assert snapshot_solo()==baseline
        assert original_body==sql("SELECT prosrc FROM pg_proc WHERE oid='aqua_championship_private.legacy_save_game_attempt(text,integer,text,integer,integer,integer,uuid)'::regprocedure;")
        assert value(solo_probe,OWNERS[0])==original_solo
        sql(migration) # repeatable installation must never clone its own wrapper
        assert snapshot_solo()==baseline
        assert policies_before==sql("SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='public' AND tablename IN ('game_attempts','game_progress');")
        check('atomic migration twice; original body + SOLO behavior/grants preserved; no data rewritten')
        for who,role in [(OWNERS[0],'authenticated'),(OTHER_TEACHER,'authenticated'),(None,'anon')]:
            if who:sql("SELECT public.aqua_open_championship_v1('Rejected');",who,expect_error='42501')
            else:sql("SET ROLE anon;SELECT public.aqua_open_championship_v1('Rejected');",expect_error='42501')
        sql("SELECT * FROM aqua_championship_private.attempt_requests_v1;",OWNERS[0],expect_error='42501')
        sql(f"SELECT public.aqua_close_championship_v1('{FOREIGN_SESSION}');",TEACHER,expect_error='42501')
        check('anon/student/other-teacher lifecycle rejected; private receipts inaccessible; foreign session protected')
        session=open_session()
        assert int(sql(f"SELECT count(*) FROM public.championship_participants WHERE session_id='{session}' AND official_score=0 AND completion_status='REGISTERED';"))==14
        assert sql(f"SELECT created_by FROM public.championship_sessions WHERE id='{session}';")==TP
        sql("SELECT public.aqua_open_championship_v1('Duplicate');",TEACHER,expect_error='55000')
        assert value("SELECT jsonb_agg(t) FROM public.aqua_teacher_championship_sessions_v1() t;",TEACHER)[0]['id']==session
        assert value("SELECT jsonb_agg(t) FROM public.aqua_student_championship_v1() t;",OWNERS[0])[0]['student_id']==ROSTER[0]
        check('OPEN registers 14 profiles atomically; created_by profile PK; scoped teacher/student discovery')
        # Simulate loss of membership as admin in the isolated fixture only.
        sql(f"DELETE FROM public.championship_participants WHERE session_id='{session}' AND student_id='{ROSTER[-1]}';")
        sql('SELECT '+keyed(session)+';',OWNERS[-1],expect_error='42501')
        assert value("SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM public.aqua_student_championship_v1() t;",OWNERS[-1]) == []
        sql(f"INSERT INTO public.championship_participants(session_id,student_id) VALUES('{session}','{ROSTER[-1]}');")
        check('unenrolled student cannot discover or save a Championship result')
        key=str(uuid.uuid4())
        def same(_):return value('SELECT '+keyed(session,key)+';',OWNERS[0])
        with futures.ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(same,range(8)))
        assert len({v['attempt_id'] for v in results})==1 and count(session)==1 and score(session)==90
        sql('SELECT '+keyed(session,key,correct=8)+';',OWNERS[0],expect_error='22023')
        check('8 concurrent identical requests create one archive/number/receipt; changed payload rejected')
        # Legitimate new attempts remain archived; totals use best per location.
        value('SELECT '+keyed(session,correct=6)+';',OWNERS[0])
        value('SELECT '+keyed(session,correct=7)+';',OWNERS[0])
        assert count(session)==3 and score(session)==90
        value('SELECT '+keyed(session,correct=8,location=2)+';',OWNERS[0])
        assert score(session)==170
        check('90/60/70 on mission 1 => 90, mission 2 +80 => 170; all new plays archived')
        def distinct(i):return value('SELECT '+keyed(session,correct=i%11)+';',OWNERS[0])
        with futures.ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(distinct,range(8)))
        nums=value(f"SELECT jsonb_agg(attempt_number ORDER BY attempt_number) FROM public.game_attempts WHERE session_id='{session}' AND student_id='{ROSTER[0]}' AND location_id='1';")
        assert nums==list(range(1,12)),nums
        assert score(session)==170
        check('concurrent distinct plays serialize MAX+1 without duplicate numbers or lost best score')
        # Same key belongs independently to a different authenticated owner.
        value('SELECT '+keyed(session,key,correct=5)+';',OWNERS[1])
        assert score(session,ROSTER[1])==50
        sql('SELECT '+keyed(session,correct=9,location=3).replace(",2,'3'",",1,'3'")+';',OWNERS[0],expect_error='22023')
        check('owner isolation and location/level validation')
        before=count(session);rid=str(uuid.uuid4())
        sql('BEGIN;SELECT '+keyed(session,rid)+";DO $$BEGIN RAISE EXCEPTION 'synthetic rollback';END$$;COMMIT;",OWNERS[0],expect_error='P0001')
        assert count(session)==before and int(sql(f"SELECT count(*) FROM aqua_championship_private.attempt_requests_v1 WHERE request_id='{rid}';"))==0
        value('SELECT '+keyed(session,rid)+';',OWNERS[0])
        assert count(session)==before+1
        check('failure rolls back attempt/score/receipt; retry after rollback writes once')
        save=start('BEGIN;SELECT '+keyed(session)+';SELECT pg_sleep(2);COMMIT;',OWNERS[0],'aqua-save-holds')
        wait_for('aqua-save-holds','sleep')
        closing=start(f"SELECT public.aqua_close_championship_v1('{session}');",TEACHER,'aqua-close-waits')
        wait_for('aqua-close-waits','lock')
        finish(save);finish(closing)
        assert sql(f"SELECT status FROM public.championship_sessions WHERE id='{session}';")=='CLOSED'
        before=count(session)
        assert value('SELECT '+keyed(session,key)+';',OWNERS[0])==results[0]
        assert count(session)==before
        close(session)
        check('save SHARE blocks close UPDATE; confirmed retry after CLOSED creates no write; close repeatable')
        session2=open_session()
        closing=start(f"BEGIN;SELECT public.aqua_close_championship_v1('{session2}');SELECT pg_sleep(2);COMMIT;",TEACHER,'aqua-close-holds')
        wait_for('aqua-close-holds','sleep')
        saving=start('SELECT '+keyed(session2)+';',OWNERS[0],'aqua-save-waits')
        wait_for('aqua-save-waits','lock')
        finish(closing);finish(saving,'55000')
        assert count(session2)==0
        check('close UPDATE blocks save SHARE; new save rejects CLOSED with zero partial writes')
        session3=open_session()
        sql('SELECT '+keyed(session3,key)+';',OWNERS[0],expect_error='22023')
        # Old website uses unchanged 7-argument contract; no request => no fake deduplication.
        r1=value('SELECT '+legacy(session3)+';',OWNERS[0]);r2=value('SELECT '+legacy(session3)+';',OWNERS[0])
        assert not r1['idempotency_supported'] and r1['attempt_id']!=r2['attempt_id'] and score(session3)==90
        assert count(session3)==2
        # Other application (even same teacher) retains original additive semantics.
        value('SELECT '+legacy(FOREIGN_SESSION,correct=6)+';',OWNERS[0]);value('SELECT '+legacy(FOREIGN_SESSION,correct=7)+';',OWNERS[0])
        assert score(FOREIGN_SESSION)==130
        check('legacy AQUA contract works with best score; cross-session key reuse denied; other app unchanged')
        # Read actual game metadata, not an independently invented list of locations.
        meta=subprocess.run(['node','--import','tsx','--input-type=module','-e',"import { MISSION_LOCATIONS } from './src/data/locations.ts'; console.log(JSON.stringify(MISSION_LOCATIONS.map(({id,levelId})=>({id,levelId}))));"],cwd=ROOT,text=True,capture_output=True,timeout=10)
        assert meta.returncode==0,meta.stderr
        locations=json.loads(meta.stdout)
        assert [loc['id'] for loc in locations]==list(range(1,11))
        for loc in locations:
            assert loc['levelId']==(loc['id']+1)//2
            value('SELECT '+keyed(session3,correct=10,location=loc['id'])+';',OWNERS[1])
        check('all 10 real game location IDs and level relationships accepted by the actual SQL')
        value('SELECT '+keyed(session3,correct=0,location=1)+';',OWNERS[1])
        assert score(session3,ROSTER[1])==1000
        assert sql(f"SELECT completion_status FROM public.championship_participants WHERE session_id='{session3}' AND student_id='{ROSTER[1]}';")=='COMPLETED'
        check('10 distinct missions complete at best total 1000; a lower replay never reduces the best score')
        close(session3)
        # An actual error DURING participant insertion must roll back session + scope + all rows.
        counts=sql('SELECT jsonb_build_array((SELECT count(*) FROM public.championship_sessions),(SELECT count(*) FROM public.championship_participants),(SELECT count(*) FROM aqua_championship_private.sessions_v1));')
        sql(f"CREATE FUNCTION public.synthetic_registration_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.student_id='{ROSTER[-1]}'::uuid THEN RAISE EXCEPTION 'synthetic registration failure';END IF;RETURN NEW;END$$;CREATE TRIGGER synthetic_registration_failure BEFORE INSERT ON public.championship_participants FOR EACH ROW EXECUTE FUNCTION public.synthetic_registration_failure();")
        sql("SELECT public.aqua_open_championship_v1('Synthetic transaction failure');",TEACHER,expect_error='P0001')
        assert counts==sql('SELECT jsonb_build_array((SELECT count(*) FROM public.championship_sessions),(SELECT count(*) FROM public.championship_participants),(SELECT count(*) FROM aqua_championship_private.sessions_v1));')
        sql('DROP TRIGGER synthetic_registration_failure ON public.championship_participants;DROP FUNCTION public.synthetic_registration_failure();')
        check('mid-registration SQL failure rolls back session, namespace registry and every participant')
        before=int(sql('SELECT count(*) FROM public.championship_sessions;'))
        sql(f"UPDATE public.student_profiles SET is_active=false WHERE id='{ROSTER[-1]}';")
        sql("SELECT public.aqua_open_championship_v1('Incomplete');",TEACHER,expect_error='22023')
        assert int(sql('SELECT count(*) FROM public.championship_sessions;'))==before
        sql(f"UPDATE public.student_profiles SET is_active=true WHERE id='{ROSTER[-1]}';")
        assert snapshot_solo()==baseline
        check('invalid roster rolls back opening; all synthetic SOLO records/progress byte-identical')
        # RLS owner tests through authenticated role, not admin bypass.
        own=int(sql("SELECT count(*) FROM public.game_attempts;",OWNERS[0]))
        all_count=int(sql('SELECT count(*) FROM public.game_attempts;'))
        assert 0<own<all_count
        sql("INSERT INTO public.game_attempts DEFAULT VALUES;",OWNERS[0],expect_error='42501')
        check('existing student SELECT RLS retained; direct game_attempt writes still forbidden')
        # Destructive legacy reset compatibility, ONLY in this disposable fixture.
        before_reset=snapshot_solo()
        # Initially the fixture has SELECT grants only; denied operations cannot erase scores.
        sql("DELETE FROM public.game_attempts;",TEACHER,expect_error='42501')
        sql("GRANT DELETE ON public.game_attempts,public.game_progress,public.championship_sessions,public.championship_participants TO authenticated;")
        # A DELETE grant without a DELETE/ALL RLS policy deletes zero rows.
        sql("DELETE FROM public.game_attempts;DELETE FROM public.game_progress;",TEACHER)
        assert snapshot_solo()==before_reset
        check('SELECT-only RLS denies/filters legacy deletes without changing scores')
        # Simulate the separately authorized deleter that a legacy reset would need.
        # These policies are TEST-ONLY and are never included in the migration.
        for table in ('game_attempts','game_progress','championship_participants'):
            sql(f"CREATE POLICY synthetic_teacher_delete ON public.{table} FOR DELETE TO authenticated USING(auth.uid()='{TEACHER}'::uuid AND student_id=ANY(public.aqua_championship_roster_v1()));")
        # Roster helper is intentionally private to RPCs, so the test policy uses an explicit scoped list.
        for table in ('game_attempts','game_progress','championship_participants'):
            sql(f"ALTER POLICY synthetic_teacher_delete ON public.{table} USING(auth.uid()='{TEACHER}'::uuid AND student_id IN ('{ROSTER[0]}'::uuid,'{ROSTER[1]}'::uuid,'{ROSTER[-1]}'::uuid));")
        sql(f"CREATE POLICY synthetic_teacher_delete ON public.championship_sessions FOR DELETE TO authenticated USING(auth.uid()='{TEACHER}'::uuid AND created_by='{TP}'::uuid);")
        error=sql(f"DELETE FROM public.game_attempts WHERE id='{results[0]['attempt_id']}';",TEACHER,expect_error='23503')
        assert 'attempt_requests_v1_attempt_id_fkey' in error
        error=sql(f"BEGIN;DELETE FROM public.championship_participants WHERE session_id='{session2}';DELETE FROM public.championship_sessions WHERE id='{session2}';COMMIT;",expect_error='23503')
        assert 'sessions_v1_session_id_fkey' in error
        assert snapshot_solo()==before_reset
        check('non-cascading FK blocks deletion of receipted attempts and an otherwise empty managed session')
        # Mirror separate REST transactions: first DELETE fails, but a subsequent
        # progress DELETE can still succeed. Roll it back here to retain test baselines.
        sql('DELETE FROM public.game_attempts;',TEACHER,expect_error='23503')
        probe=sql('BEGIN;DELETE FROM public.game_progress;SELECT count(*) FROM public.game_progress;ROLLBACK;',TEACHER)
        assert probe.splitlines()[-1]=='0'
        probe=sql(f"BEGIN;DELETE FROM public.championship_participants WHERE student_id='{ROSTER[-1]}';SELECT count(*) FROM public.championship_participants WHERE student_id='{ROSTER[-1]}';ROLLBACK;",TEACHER)
        assert probe.splitlines()[-1]=='0'
        assert snapshot_solo()==before_reset
        check('legacy multi-request reset is NOT atomic: later progress/unused membership deletes remain possible; rollback probes preserve SOLO')
        print(f'ALL {passed} POSTGRESQL SCENARIOS PASSED (synthetic fixture; no production access).',flush=True)
    finally:
        docker('rm','--force',NAME)
if __name__=='__main__':main()
