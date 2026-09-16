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
    # Contact shield: brief, soft mechanical tap, without a laser pitch sweep.
    samples = []
    smooth = 0
    for i in range(round(.12 * 44100)):
        t = i / 44100
        smooth = .86 * smooth + .14 * rng.uniform(-1, 1)
        env = min(1, t/.004) * math.exp(-t*42) * min(1, (.12-t)/.02)
        samples.append((.7*math.sin(2*math.pi*310*t)+.2*math.sin(2*math.pi*625*t)+smooth*.6)*env)
    write_pcm('orbital-contact', samples)
    # Blade: moving air and a short metallic edge, not a projectile chirp.
    samples = []
    smooth = 0
    for i in range(round(.18 * 44100)):
        t = i / 44100
        noise = rng.uniform(-1, 1)
        smooth = .8*smooth + .2*noise
        env = math.sin(math.pi*t/.18)**2 * math.exp(-t*8)
        samples.append(((noise-smooth)*.6 + .12*math.sin(2*math.pi*1450*t))*env)
    write_pcm('blade-swish', samples)
    # Beam: restrained sustained energy, a different envelope from the plasma shot.
    samples = []
    for i in range(round(.48 * 44100)):
        t = i / 44100
        env = min(1,t/.018)*min(1,(.48-t)/.12)*math.exp(-t*2)
        tone = math.sin(2*math.pi*220*t)+.3*math.sin(2*math.pi*441*t)+.1*math.sin(2*math.pi*880*t)
        samples.append(tone*(.9+.1*math.sin(2*math.pi*28*t))*env)
    write_pcm('prism-beam', samples)
    # Sustain beds are periodic over 0.5 seconds, without a baked-in envelope.
    # Runtime gain provides attack/release and follows the actual effect lifetime.
    for name, base in [('prism-loop', 220), ('gravity-loop', 110)]:
        samples = []
        for i in range(22050):
            t = i/44100
            samples.append((math.sin(2*math.pi*base*t)+.32*math.sin(2*math.pi*base*2*t)+
                .15*math.sin(2*math.pi*base*4*t))*(.88+.12*math.cos(2*math.pi*8*t)))
        write_pcm(name, samples)
    samples = []
    phase = 0
    for i in range(round(.42*44100)):
        t=i/44100
        phase+=2*math.pi*(170+320*(t/.42)**2)/44100
        env=math.sin(math.pi*t/.42)**1.3
        samples.append((.7*math.sin(phase)+.25*math.sin(phase*1.5)+.08*rng.uniform(-1,1))*env)
    write_pcm('gravity-open', samples)
    for name, length, freq, noise_gain in [('energy-impact',.11,580,.35),('player-hurt',.19,185,.65)]:
        samples=[]
        for i in range(round(length*44100)):
            t=i/44100
            env=min(1,t/.003)*math.exp(-t*26)*min(1,(length-t)/.025)
            tone=math.sin(2*math.pi*(freq*t-freq*.65*t*t))
            samples.append((tone*.55+rng.uniform(-1,1)*noise_gain)*env)
        write_pcm(name,samples)
    samples=[]
    for i in range(round(.24*44100)):
        t=i/44100
        # Two short rising pulses signal enemy intent, distinct from reward arpeggios.
        pulse=t% .12
        env=math.sin(math.pi*min(1,pulse/.09))**2 if pulse<.09 else 0
        samples.append(math.sin(2*math.pi*(620*t+450*t*t))*env)
    write_pcm('enemy-windup',samples)
    samples=[]
    for i in range(round(.075*44100)):
        t=i/44100
        env=min(1,t/.002)*math.exp(-t*46)*min(1,(.075-t)/.015)
        samples.append((math.sin(2*math.pi*1040*t)+.32*math.sin(2*math.pi*1560*t))*env)
    write_pcm('crystal-pickup',samples)
    manifest_path = ROOT / 'assets/manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    records = {entry['path']: entry for entry in manifest['files']}
    for source in sorted(AUDIO.glob('*.wav')):
        rel = source.relative_to(ROOT).as_posix()
        if source.stem in ['plasma-shot', 'enemy-shatter', 'orbital-contact', 'blade-swish', 'prism-beam',
                'gravity-open', 'gravity-loop', 'prism-loop', 'energy-impact', 'player-hurt', 'enemy-windup', 'crystal-pickup']:
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
