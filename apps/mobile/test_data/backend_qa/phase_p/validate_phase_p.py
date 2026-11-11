#!/usr/bin/env python3
"""Validate Phase P Postman assets and safe local QA tooling."""
from __future__ import annotations
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
COLLECTION = HERE / 'TOEIC_Phase_P_Backend_QA.postman_collection.json'
ENV_TEMPLATE = HERE / 'TOEIC_Phase_P_QA.postman_environment.template.json'
SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
ALLOWED = [
    (r'^/ready$', {'GET'}),
    (r'^/api/v1/auth/(login|refresh|logout)$', {'POST'}),
    (r'^/api/v1/users/me$', {'GET','PATCH'}),
    (r'^/api/v1/learning/vocabulary-topics(?:/\{\{topicId\}\})?$', {'GET'}),
    (r'^/api/v1/learning/vocabularies(?:/\{\{vocabularyId\}\})?$', {'GET'}),
    (r'^/api/v1/learning/lessons(?:/\{\{lessonId\}\})?$', {'GET'}),
    (r'^/api/v1/learning/review-today$', {'GET'}),
    (r'^/api/v1/learning/progress$', {'GET'}),
    (r'^/api/v1/tests$', {'GET'}),
    (r'^/api/v1/tests/\{\{testId\}\}$', {'GET'}),
    (r'^/api/v1/tests/\{\{testId\}\}/parts$', {'GET'}),
    (r'^/api/v1/tests/\{\{testId\}\}/attempts$', {'POST'}),
    (r'^/api/v1/attempts$', {'GET'}),
    (r'^/api/v1/attempts/\{\{attemptId\}\}$', {'GET'}),
    (r'^/api/v1/attempts/\{\{attemptId\}\}/answers/\{\{firstQuestionId\}\}$', {'PUT'}),
    (r'^/api/v1/attempts/\{\{attemptId\}\}/submit$', {'POST'}),
    (r'^/api/v1/analytics/(progress|scores|practices|streak|prediction|weak-areas)$', {'GET'}),
]
SECRET_KEYS = {'qaUserAPassword','qaUserBPassword','accessTokenA','refreshTokenA','previousRefreshTokenA','revokedRefreshTokenA','accessTokenB','refreshTokenB'}

def iter_items(items):
    for item in items:
        if 'request' in item: yield item
        for child in item.get('item', []): yield from iter_items([child])

def validate(collection, env):
    errors=[]
    if collection.get('info',{}).get('schema') != SCHEMA: errors.append('Postman schema must be v2.1.0.')
    reqs=list(iter_items(collection.get('item',[])))
    if len(reqs) < 25: errors.append(f'Expected at least 25 requests, found {len(reqs)}.')
    names={x.get('name') for x in reqs}
    required={'Gateway readiness (QA mode required)','Login QA User A','GET current profile - User A','List vocabulary topics','Get vocabulary topic detail','List vocabularies for selected topic','Get vocabulary detail','List published grammar lessons','Get grammar lesson detail','List tests','Get seeded test detail','Get seeded test parts availability','Start FULL attempt','Save first answer','Submit FULL attempt','Get submitted result','Get attempt history','Analytics progress','Analytics scores','Analytics practices','Analytics streak','Analytics prediction','Analytics weak areas','Login QA User B','User B cannot read User A attempt','Refresh User A session (rotate token)','Replayed previous refresh token is rejected','Logout QA User A'}
    missing=required-names
    if missing: errors.append('Missing required request(s): '+', '.join(sorted(missing)))
    for item in reqs:
        request=item.get('request',{})
        method=request.get('method','').upper()
        url=request.get('url','')
        if isinstance(url,dict): url=url.get('raw','')
        path=url.replace('{{gatewayOrigin}}','').replace('{{baseUrl}}','/api/v1')
        path=path.split('?',1)[0]
        matched=any(re.match(pattern,path) and method in methods for pattern,methods in ALLOWED)
        if not matched: errors.append(f'Unapproved route/method: {method} {path}')
        if not item.get('event'): errors.append(f'Missing test script: {item.get("name")}')
        if not request.get('auth') or item.get('auth') is not None: errors.append(f'Auth must be stored on the Postman Request object: {item.get("name")}')
        raw=json.dumps(item,ensure_ascii=False)
        if re.search(r'Bearer\s+[A-Za-z0-9._-]{20,}',raw): errors.append(f'Hard-coded bearer token found in {item.get("name")}')
    if env.get('_postman_variable_scope') != 'environment': errors.append('Environment template scope is invalid.')
    env_values={x.get('key'):x.get('value') for x in env.get('values',[]) if isinstance(x,dict)}
    for key in SECRET_KEYS:
        if env_values.get(key) not in ('',None): errors.append(f'Secret variable {key} must be empty in template.')
    if env_values.get('seedTestId') not in ('',None): errors.append('seedTestId must be populated only by the seed registry preparation script.')
    if env_values.get('qaReadyConfirmed') not in ('',None): errors.append('qaReadyConfirmed must be blank in the environment template.')
    preflight=next((x for x in reqs if x.get('name')=='Gateway readiness (QA mode required)'),None)
    preflight_pre='\n'.join(line for ev in (preflight or {}).get('event',[]) if ev.get('listen')=='prerequest' for line in ev.get('script',{}).get('exec',[]))
    preflight_test='\n'.join(line for ev in (preflight or {}).get('event',[]) if ev.get('listen')=='test' for line in ev.get('script',{}).get('exec',[]))
    if 'qaReadyConfirmed' not in preflight_pre: errors.append('Preflight must clear the QA confirmation marker before each full collection run.')
    if 'pm.execution.setNextRequest(null)' not in preflight_test: errors.append('Preflight must stop the collection when QA readiness is not confirmed.')
    if 'd.checks && typeof d.checks === \"object\"' not in preflight_test: errors.append('Preflight must require the readiness checks object before enabling QA execution.')
    for folder in collection.get('item',[])[1:]:
        folder_pre='\n'.join(line for ev in folder.get('event',[]) if ev.get('listen')=='prerequest' for line in ev.get('script',{}).get('exec',[]))
        if 'qaReadyConfirmed' not in folder_pre or 'pm.execution.skipRequest()' not in folder_pre:
            errors.append(f'Folder is missing the QA preflight guard: {folder.get("name")}')
    if 'submittedAttemptId' not in env_values: errors.append('Environment template must define submittedAttemptId for completion-gated ID capture.')
    start=next((x for x in reqs if x.get('name')=='Start FULL attempt'),None)
    start_script='\n'.join(line for ev in (start or {}).get('event',[]) if ev.get('listen')=='test' for line in ev.get('script',{}).get('exec',[]))
    if 'pm.response.to.have.status(201)' not in start_script: errors.append('Start attempt must assert HTTP 201, matching the NestJS @Post controller default.')
    submit=next((x for x in reqs if x.get('name')=='Submit FULL attempt'),None)
    submit_script='\n'.join(line for ev in (submit or {}).get('event',[]) if ev.get('listen')=='test' for line in ev.get('script',{}).get('exec',[]))
    if 'pm.response.to.have.status(201)' not in submit_script: errors.append('Submit attempt must assert HTTP 201, matching the NestJS @Post controller default.')
    if 'submittedAttemptId' not in submit_script: errors.append('Submit request must record submittedAttemptId after successful SUBMITTED response.')
    for key in ('qaUserAEmail','qaUserBEmail','qaUserAPassword','qaUserBPassword'):
        if env_values.get(key) not in ('',None): errors.append(f'Credential variable {key} must be empty in template.')
    return errors, len(reqs)

def main():
    try:
        collection=json.loads(COLLECTION.read_text(encoding='utf-8'))
        env=json.loads(ENV_TEMPLATE.read_text(encoding='utf-8'))
    except (OSError,json.JSONDecodeError) as exc:
        print(f'FAIL: {exc}'); return 1
    errors,count=validate(collection,env)
    if errors:
        for e in errors: print('FAIL:',e)
        print(f'Phase P validation failed ({len(errors)} issue(s), {count} requests).')
        return 1
    print(f'PASS: Postman v2.1 collection; {count} requests; route/method allow-list; QA-only empty secret template.')
    return 0

if __name__=='__main__': raise SystemExit(main())
