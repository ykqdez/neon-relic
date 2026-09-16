"""Rebuild browser-compatible PCM effects. Offline tool; requires soundfile for OGG import."""
import array
import hashlib
import json
import math
from pathlib import Path
import random
import wave

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'assets/audio'


def write_pcm(name, samples, rate=44100):
    peak = max(abs(x) for x in samples) or 1
    pcm = array.array('h', (round(x / peak * 24500) for x in samples))
    with wave.open(str(AUDIO / (name + '.wav')), 'wb') as out:
        out.setparams((1, 2, rate, len(pcm), 'NONE', 'not compressed'))
        out.writeframes(pcm.tobytes())


def generate():
    import soundfile as sf
    for source in sorted(AUDIO.glob('*.ogg')):
        data, rate = sf.read(source, always_2d=True)
        # Preserve source amplitude and timing; only downmix and change the container/codec.
        sf.write(source.with_suffix('.wav'), data.mean(axis=1), rate, subtype='PCM_16')
    rng = random.Random(6041)
    samples = []
    phase = 0
    for i in range(round(.32 * 44100)):
        t = i / 44100
        phase += 2 * math.pi * (140 + 1600 * math.exp(-t * 24)) / 44100
        body = .55 * math.sin(phase) + .2 * math.sin(phase * 2.01)
        thump = .32 * math.sin(2 * math.pi * 95 * t) * math.exp(-t * 32)
        air = .1 * rng.uniform(-1, 1) * math.exp(-t * 55)
        env = min(1, t / .004) * math.exp(-t * 14) * min(1, (.32-t) / .04)
        samples.append((body + thump + air) * env)
    write_pcm('plasma-shot', samples)
    samples = []
    previous = 0
    for i in range(round(.18 * 44100)):
        t = i / 44100
        noise = rng.uniform(-1, 1)
        # Short brittle crumble, distinct from an explosion or a reward chime.
        grains = max(0, math.sin(2 * math.pi * 53 * t)) ** 2
        crack = (noise - previous * .7) * (.25 + .75 * grains)
        previous = noise
        tone = .18 * math.sin(2 * math.pi * (460 * t - 650 * t*t))
        env = min(1, t / .002) * math.exp(-t * 23) * min(1, (.18-t) / .04)
        samples.append((crack * .65 + tone) * env)
    write_pcm('enemy-shatter', samples)
    manifest_path = ROOT / 'assets/manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    records = {entry['path']: entry for entry in manifest['files']}
    for source in sorted(AUDIO.glob('*.wav')):
        rel = source.relative_to(ROOT).as_posix()
        if source.stem in ['plasma-shot', 'enemy-shatter']:
            origin, license_id = 'tools/build_audio.py', 'CC0-1.0'
        elif source.stem == 'lightning-crack':
            origin, license_id = 'https://opengameart.org/content/thunder', 'CC-BY-3.0'
        else:
            origin, license_id = 'https://kenney.nl/assets/digital-audio', 'CC0-1.0'
        records[rel] = dict(path=rel, bytes=source.stat().st_size,
            sha256=hashlib.sha256(source.read_bytes()).hexdigest(), source=origin, license=license_id)
    manifest['files'] = sorted(records.values(), key=lambda entry: entry['path'])
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf8')


if __name__ == '__main__':
    generate()
