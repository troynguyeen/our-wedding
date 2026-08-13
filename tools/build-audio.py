#!/usr/bin/env python3
"""Dựng hiệu ứng tiếng cào giấy cho màn scratch.

    python3 tools/build-audio.py

Nguồn nằm trong Wedding/ (đã gitignore), chỉ file trong assets/ được commit —
nên script này là bản ghi duy nhất cho biết asset đã được tạo ra thế nào.

Chuỗi xử lý: .mov -> WAV (afconvert) -> mono + cắt lặng đầu + chuẩn hoá (python)
-> AAC .m4a (afconvert). Máy không có ffmpeg nên dùng afconvert của macOS.
"""

import math
import struct
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'Wedding' / 'paper scratching sound .mov'
OUT = ROOT / 'assets' / 'sfx-scratch.m4a'

PEAK_DBFS = -3.0    # chuẩn hoá tới đây; bản gốc chỉ -22 dBFS, quá nhỏ so với
                    # loa điện thoại khi ngón tay đang che mặt kính
HEAD_DBFS = -60.0   # ngưỡng coi là đã có tín hiệu, đo trên cửa sổ 5ms
BITRATE = 96000     # mono 96k là thừa đủ cho tiếng ồn băng rộng


def afconvert(*args):
    subprocess.run(['afconvert', *map(str, args)], check=True)


def read_wav(path):
    with wave.open(str(path)) as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = struct.unpack('<%dh' % (n * ch), w.readframes(n))
    # gộp về mono: tiếng giấy không có thông tin stereo đáng giữ, bỏ đi thì
    # file nhẹ đi một nửa
    mono = [sum(raw[i * ch:(i + 1) * ch]) / ch for i in range(n)] if ch > 1 else list(raw)
    return mono, sr


def head_trim(mono, sr):
    """Vị trí âm thanh thật sự bắt đầu, bỏ phần lặng số ở đầu file.

    Chỉ cắt đầu chứ không cắt đuôi: đuôi file đã tắt hẳn về 0, nên điểm nối
    khi loop là 0 -> gần 0, không nghe 'cạch'. Cắt đuôi sẽ tạo ra đúng cái
    bước nhảy biên độ mà ta đang tránh.
    """
    win = max(1, int(sr * 0.005))
    for i in range(0, len(mono), win):
        seg = mono[i:i + win]
        rms = math.sqrt(sum(x * x for x in seg) / len(seg))
        if rms > 0 and 20 * math.log10(rms / 32768) > HEAD_DBFS:
            return i
    return 0


def main():
    if not SRC.exists():
        sys.exit(f'thiếu file nguồn: {SRC}')

    with tempfile.TemporaryDirectory() as tmp:
        decoded = Path(tmp) / 'decoded.wav'
        shaped = Path(tmp) / 'shaped.wav'
        afconvert('-f', 'WAVE', '-d', 'LEI16', SRC, decoded)

        mono, sr = read_wav(decoded)
        mono = mono[head_trim(mono, sr):]

        peak = max(abs(x) for x in mono)
        gain = (32768 * 10 ** (PEAK_DBFS / 20)) / peak
        clamp = lambda v: max(-32768, min(32767, int(round(v))))
        pcm = b''.join(struct.pack('<h', clamp(x * gain)) for x in mono)

        with wave.open(str(shaped), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(pcm)

        afconvert('-f', 'm4af', '-d', 'aac', '-b', str(BITRATE), '-s', '3', shaped, OUT)

    print(f'{OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.1f} KB  '
          f'{len(mono) / sr:.2f}s mono {sr} Hz  (gain +{20 * math.log10(gain):.1f} dB)')


if __name__ == '__main__':
    main()
