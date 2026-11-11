#!/usr/bin/env python3
"""Regenerate relative timestamps in local storage fixtures for today's date."""
import json, sys
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
root=Path(__file__).resolve().parents[1]
now=datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).replace(microsecond=0)
source=json.loads((root/'learning/vocabulary_catalog_current_source.json').read_text(encoding='utf-8'))
items={x['id']:x for x in source['items']}
sets={
 'empty':([],20,True),
 'goal_in_progress_3_of_5':(['t1-v1','t1-v2','t1-v3'],5,True),
 'goal_completed_5':(['t1-v1','t1-v2','t1-v3','t2-v1','t2-v2'],5,True),
 'six_words_default_goal_20':(list(items),20,True),
 'reminders_disabled':(['t1-v1','t1-v2'],5,False),
}
for name,(ids,goal,reminder) in sets.items():
 words={}
 for i,wid in enumerate(ids):
  x=items[wid]
  first=now-timedelta(days=i+3)
  last=now-timedelta(minutes=(len(ids)-i)*5)
  # Exact StoredVocabularyWord.toJson schema: use `grade`, not UI model's `masteryGrade`.
  words[wid]={'id':x['id'],'word':x['word'],'phonetic':x.get('phonetic',''),'definition':x.get('definition',''),'example':x.get('example',''),'audioUrl':x.get('audioUrl',''),'topicId':x.get('topicId',''),'topicName':x.get('topicName',''),'grade':x['masteryGrade'],'serverRevision':None,'firstStudiedAt':first.isoformat(),'lastStudiedAt':last.isoformat()}
 (root/'learning/vocabulary_progress'/f'{name}.json').write_text(json.dumps({'dailyGoal':goal,'remindEnabled':reminder,'words':words},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Generated timestamped progress fixtures for {now.isoformat()}')
