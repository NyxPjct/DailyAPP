"""Build an Android installer with the configured SDK, JDK and proxy."""

from pathlib import Path
from urllib.parse import urlparse
import os
import shutil
import subprocess
import sys
import argparse
import json

parser = argparse.ArgumentParser()
parser.add_argument("--personal", action="store_true", help="Build the signed personal-use release")
args = parser.parse_args()
variant = "release" if args.personal else "debug"

root = Path(__file__).resolve().parent.parent
version = ".".join(json.loads((root / "package.json").read_text())["version"].split(".")[:2])
env = os.environ.copy()
toolchains = Path("/workspace/.toolchains")

if not env.get("JAVA_HOME") and (toolchains / "java21/bin/javac").exists():
    env["JAVA_HOME"] = str(toolchains / "java21")
if not env.get("ANDROID_HOME") and (toolchains / "android-sdk").exists():
    env["ANDROID_HOME"] = str(toolchains / "android-sdk")

for variable, directory in (
    ("ANDROID_USER_HOME", root / ".cache/android-user"),
    ("GRADLE_USER_HOME", root / ".cache/gradle"),
):
    env.setdefault(variable, str(directory))
    Path(env[variable]).mkdir(parents=True, exist_ok=True)

properties = root / "android/local.properties"
sdk = env.get("ANDROID_HOME") or env.get("ANDROID_SDK_ROOT")
if not properties.exists() and sdk:
    escaped = sdk.replace("\\", "\\\\").replace(":", "\\:")
    properties.write_text("sdk.dir=" + escaped + "\n", encoding="utf-8")

proxy = urlparse(env.get("HTTPS_PROXY") or env.get("HTTP_PROXY", ""))
if proxy.hostname:
    port = proxy.port or (443 if proxy.scheme == "https" else 8080)
    options = " ".join(
        f"-D{protocol}.proxyHost={proxy.hostname} -D{protocol}.proxyPort={port}"
        for protocol in ("http", "https")
    )
    # The wrapper downloads Gradle before parsing build arguments. JVM options
    # must be available at that point, as well as during dependency resolution.
    env["GRADLE_OPTS"] = (env.get("GRADLE_OPTS", "") + " " + options).strip()

wrapper = "gradlew.bat" if os.name == "nt" else "./gradlew"
result = subprocess.run(
    [wrapper, "assembleRelease" if args.personal else "assembleDebug", "--no-daemon", "--max-workers=2", "--console=plain"],
    cwd=root / "android",
    env=env,
)
if result.returncode:
    sys.exit(result.returncode)

apk = root / f"android/app/build/outputs/apk/{variant}/app-{variant}.apk"
if not apk.is_file():
    sys.exit("O Gradle terminou, mas o instalador Android não foi encontrado.")
output = root / (f"artifacts/DailyAPP-{version}-pessoal.apk" if args.personal else "artifacts/DailyAPP-android-teste.apk")
if args.personal and sdk:
    verifier = Path(sdk) / "build-tools/36.0.0" / ("apksigner.bat" if os.name == "nt" else "apksigner")
    if verifier.is_file():
        def certificate(filename):
            checked = subprocess.run([str(verifier), "verify", "--print-certs", str(filename)], env=env, capture_output=True, text=True)
            if checked.returncode:
                sys.exit("A verificação da assinatura do APK falhou.")
            for line in checked.stdout.splitlines():
                if line.startswith("Signer #1 certificate SHA-256 digest:"):
                    return line.split(":", 1)[1].strip()
            sys.exit("O certificado do instalador não foi encontrado.")
        signed_by = certificate(apk)
        previous = root / "artifacts/DailyAPP-android-teste.apk"
        if previous.exists() and certificate(previous) != signed_by:
            sys.exit("A assinatura difere da versão de teste anterior. Preserve a chave original para instalar uma atualização.")
output.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(apk, output)
print(f"Instalador Android {'de uso pessoal' if args.personal else 'de teste'}: {output}")
