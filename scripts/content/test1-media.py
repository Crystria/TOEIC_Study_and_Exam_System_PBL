"""Technical source inventory and lossless crops. Does not certify listening content."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def write(file, value):
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def mp3_metadata(data):
    pos = 0
    if data[:3] == b'ID3':
        pos = 10 + sum((b & 127) << (7*(3-i)) for i, b in enumerate(data[6:10]))
    frames = 0
    seconds = 0
    skipped = 0
    rates = set()
    while pos + 4 <= len(data):
        h = int.from_bytes(data[pos:pos+4], 'big')
        version, layer, bi, si = (h >> 19) & 3, (h >> 17) & 3, (h >> 12) & 15, (h >> 10) & 3
        if h >> 21 != 0x7ff or version == 1 or layer != 1 or bi in [0,15] or si == 3:
            skipped += 1
            pos += 1
            continue
        sr = [44100,48000,32000][si] // (1 if version == 3 else 2 if version == 2 else 4)
        bitrate = ([0,32,40,48,56,64,80,96,112,128,160,192,224,256,320] if version == 3 else [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160])[bi]
        length = (144000 if version == 3 else 72000)*bitrate//sr + ((h>>9)&1)
        if pos + length > len(data):
            break
        frames += 1
        seconds += (1152 if version == 3 else 576)/sr
        rates.add(sr)
        pos += length
    return dict(codec='MPEG Layer III', frames=frames, frameDurationSeconds=round(seconds,3), sampleRates=sorted(rates), nonFrameBytesSkipped=skipped, contentReviewed=False, limitation='Frame inspection only; no complete decoding/listening or transcript alignment')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--evidence', required=True)
    args = parser.parse_args()
    evidence = Path(args.evidence)
    dest = Path('data/toeic/ets-2023-test-01')
    source = Path('docs/TEST 1')
    inventory = []
    coverage = []
    for file in sorted(source.rglob('*')):
        if not file.is_file():
            continue
        raw = file.read_bytes()
        item = dict(file=str(file), bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
        if file.suffix.lower() == '.mp3':
            item.update(mp3_metadata(raw))
            match = re.search(r'Part (\d)_(\d+)(?:-(\d+))?', file.name)
            if match:
                a, b = int(match[2]), int(match[3] or match[2])
                item.update(sourceId=f'ets-2023-test-01-audio-{a}-{b}', part=int(match[1]), questionNumbers=list(range(a,b+1)), ownerScope='question' if int(match[1])<3 else 'group')
                coverage.extend(range(a,b+1))
            else:
                item.update(sourceId='ets-2023-test-01-full-lc-audio', attachmentStatus='No test-level audio field/player in current contract; do not attach arbitrarily to a question')
        inventory.append(item)
    clips = [x for x in inventory if 'questionNumbers' in x]
    if len(clips) != 54 or sorted(coverage) != list(range(1,101)):
        raise ValueError('54 clip filenames must cover listening 1..100 exactly once')
    crops = []
    for key, code, page, box, owner, order in [
        ('q001-image','11',3,(570,150,1335,1260),'ets-2023-test-01-q001',None),
        ('g62-64-graphic','11',9,(1045,145,1665,680),'ets-2023-test-01-g62-64',1),
        ('g95-97-graphic','11',13,(245,145,890,550),'ets-2023-test-01-g95-97',1),
        ('g186-190-document-1','12',26,(370,105,1595,775),'ets-2023-test-01-g186-190',1),
        ('g186-190-document-2','12',26,(335,800,1640,1540),'ets-2023-test-01-g186-190',2),
        ('g186-190-document-3','12',27,(370,245,1545,990),'ets-2023-test-01-g186-190',3),
    ]:
        image = Image.open(evidence/'ocr'/code/f'page-{page:03d}.png')
        target = dest/'media'/f'{key}.png'
        target.parent.mkdir(parents=True, exist_ok=True)
        image.crop(box).save(target)
        file = next(source.glob(f'{code[0]}.{code[1]}.*.pdf'))
        crops.append(dict(sourceId='ets-2023-test-01-'+key,file=str(target),sha256=hashlib.sha256(target.read_bytes()).hexdigest(),ownerSourceId=owner,documentOrder=order,sourcePdf=str(file),pdfPage=page,renderedSize=list(image.size),cropPixels=list(box),contentReviewed=True,usage='Question/graphic crop' if code=='11' else 'Source layout QA; current payload uses ordered TEXT assets'))
    write(dest/'source-inventory.json', dict(files=inventory,audio=dict(clips=len(clips),fullTracks=1,filenameCoverageValid=True,contentReviewed=0),crops=crops))
    # Attach only the three verified exam images. Audio remains blocked until listened to.
    dataset = json.loads((dest/'dataset.json').read_text(encoding='utf-8'))
    for r in dataset['questions']+dataset['groups']:
        media=[]
        for c in crops:
            if c['ownerSourceId']==r['sourceId'] and 'document-' not in c['sourceId']:
                media.append(dict(sourceId=c['sourceId'],file=c['file'],sha256=c['sha256'],mediaType='IMAGE',contentType='image/png',field='imageKey' if r['kind']=='question' else 'asset',orderNo=1,contentReviewed=True))
        for clip in clips:
            owner = f"ets-2023-test-01-q{clip['questionNumbers'][0]:03d}" if clip['ownerScope']=='question' else f"ets-2023-test-01-g{clip['questionNumbers'][0]}-{clip['questionNumbers'][-1]}"
            if owner==r['sourceId']:
                media.append(dict(sourceId=clip['sourceId'],file=clip['file'],sha256=clip['sha256'],mediaType='AUDIO',contentType='audio/mpeg',field='audioKey',contentReviewed=False))
        if media:
            r['media']=media
    write(dest/'dataset.json',dataset)
    full=next(x for x in inventory if x.get('sourceId')=='ets-2023-test-01-full-lc-audio')
    metadata=json.loads(subprocess.check_output(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(Path(__file__).with_name('source-audio-duration.ps1')),'-SourceDirectory',str(source)],encoding='utf-8-sig'))
    full['windowsMediaDurationSeconds']=metadata['duration100Nanoseconds']/10000000
    full['windowsMediaDurationDisplay']=metadata['durationDisplay']
    full['durationDiscrepancy']='Frame-count estimate differs from Windows metadata; independent decoder/listening pending. No trimming or timer change.'
    write(dest/'source-inventory.json',dict(files=inventory,audio=dict(clips=len(clips),fullTracks=1,filenameCoverageValid=True,contentReviewed=0),crops=crops))
    print(json.dumps(dict(sourceFiles=len(inventory),clips=len(clips),fullAudioSeconds=full['frameDurationSeconds'],verifiedAudioContent=0,crops=len(crops))))


if __name__=='__main__':
    main()
