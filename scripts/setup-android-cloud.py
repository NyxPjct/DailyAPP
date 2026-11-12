"""Install verified Android build tools in the checkout's ignored cache.

Linux x86_64 only. Existing signing keys are never removed or replaced.
Archives are official Adoptium/Google releases, pinned by SHA-256. Google
archive checksums were cross-checked against its HTTPS repository metadata.
"""
from pathlib import Path
from urllib.parse import urlparse
import hashlib
import os
import platform
import shutil
import subprocess
import tarfile
import zipfile

root = Path(__file__).resolve().parent.parent
cache = root / ".cache"
cache.mkdir(exist_ok=True)
if platform.system() != "Linux" or platform.machine() not in ("x86_64", "amd64"):
    raise SystemExit("Use Android Studio and JDK 21 on this platform.")


def download(url, digest):
    target = cache / url.rsplit("/", 1)[1]
    if not target.exists():
        subprocess.run(["curl", "-fsSL", "--retry", "1", "--max-time", "180", url, "-o", str(target)], check=True)
    if hashlib.sha256(target.read_bytes()).hexdigest() != digest:
        raise SystemExit("Build-tool archive checksum mismatch: " + target.name)
    return target


def extract_zip(archive, destination):
    with zipfile.ZipFile(archive) as source:
        assert len({Path(i.filename).parts[0] for i in source.infolist()}) == 1
        for info in source.infolist():
            path = Path(info.filename)
            if path.is_absolute() or ".." in path.parts:
                raise SystemExit("Invalid archive path")
            target = destination / Path(*path.parts[1:])
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.read(info))
                target.chmod((info.external_attr >> 16) & 0o777 or 0o644)


jdk = cache / "java21"
if not (jdk / "bin/javac").exists():
    archive = download(
        "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.9%2B10/OpenJDK21U-jdk_x64_linux_hotspot_21.0.9_10.tar.gz",
        "810d3773df7e0d6c4394e4e244b264c8b30e0b05a0acf542d065fd78a6b65c2f",
    )
    unpack = cache / "jdk21-unpack"
    unpack.mkdir(exist_ok=True)
    with tarfile.open(archive) as source:
        source.extractall(unpack, filter="data")
    next(p for p in unpack.iterdir() if p.is_dir()).rename(jdk)

env = os.environ.copy()
env["JAVA_HOME"] = str(jdk)
env["ANDROID_USER_HOME"] = str(cache / "android-user")
Path(env["ANDROID_USER_HOME"]).mkdir(exist_ok=True)
ca = Path(env.get("NODE_EXTRA_CA_CERTS", "/usr/local/share/ca-certificates/environment-proxy-ca.crt"))
if ca.is_file():
    trust = cache / "java-cacerts"
    shutil.copyfile(jdk / "lib/security/cacerts", trust)
    subprocess.run([str(jdk / "bin/keytool"), "-importcert", "-noprompt", "-trustcacerts", "-alias", "dailyapp-environment-proxy", "-file", str(ca), "-keystore", str(trust), "-storepass", "changeit"], check=True, capture_output=True)
    env["JAVA_TOOL_OPTIONS"] = (env.get("JAVA_TOOL_OPTIONS", "") + " -Djavax.net.ssl.trustStore=" + str(trust)).strip()

sdk = cache / "android-sdk"
manager = sdk / "cmdline-tools/latest/bin/sdkmanager"
if not manager.exists():
    archive = download("https://dl.google.com/android/repository/commandlinetools-linux-12700392_latest.zip", "330f0db00456c26d0a7e6c7793a022fe170e5dbc03472f76e121db37cb6d4744")
    extract_zip(archive, sdk / "cmdline-tools/latest")

packages = [
    ("build-tools_r35_linux.zip", "bd3a4966912eb8b30ed0d00b0cda6b6543b949d5ffe00bea54c04c81e1561d88", sdk / "build-tools/35.0.0", "aapt"),
    ("platform-36_r02.zip", "37607369a28c5b640b3a7998868d45898ebcb777565a0e85f9acf36f29631d2e", sdk / "platforms/android-36", "android.jar"),
    ("build-tools_r36_linux.zip", "5d9ac77fb6ff43d9da518a337b4fcf8f9097113df531d99ccefe80ef7ce8250b", sdk / "build-tools/36.0.0", "apksigner"),
    ("platform-tools_r37.0.3-linux.zip", "214548146cadb2ca3508143d8a1d4be4c59de5bb837253e3ede89ed74cf450d1", sdk / "platform-tools", "adb"),
]
for name, digest, destination, marker in packages:
    if not (destination / marker).exists():
        extract_zip(download("https://dl.google.com/android/repository/" + name, digest), destination)

if not (sdk / "licenses/android-sdk-license").exists():
    flags = ["--sdk_root=" + str(sdk)]
    proxy = urlparse(env.get("HTTPS_PROXY") or env.get("HTTP_PROXY", ""))
    if proxy.hostname:
        flags += ["--proxy=http", "--proxy_host=" + proxy.hostname, "--proxy_port=" + str(proxy.port or 8080)]
    subprocess.run([str(manager), *flags, "--licenses"], input="y\n" * 100, text=True, env=env, check=True)

properties = root / "android/local.properties"
if not properties.exists():
    properties.write_text("sdk.dir=" + str(sdk) + "\n")
subprocess.run([str(jdk / "bin/javac"), "-version"], check=True)
print("Android SDK 36, Build Tools 36.0.0 and JDK 21 ready in .cache; existing signing keys preserved.")
