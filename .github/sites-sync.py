"""Import the file tree from the published Luma Studio release."""
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

ORIGIN = "https://luma-studio-darkroom.vemodalen.chatgpt.site"
PROJECT = "appgprj_6b0793cbfb8c8191a87f61d8ff67b44e"
STATE = Path(".github/sites-sync.state.json")
MAX_FILE_SIZE = 25 * 1024 * 1024
SHA256 = re.compile(r"^[a-f0-9]{64}$")


def download(path, maximum):
    for attempt in range(3):
        try:
            request = Request(ORIGIN + path, headers={"User-Agent": "Luma-Studio-source-sync"})
            with urlopen(request, timeout=30) as response:
                if not response.url.startswith(ORIGIN + "/"):
                    raise ValueError("Unexpected destination while downloading " + path)
                content = response.read(maximum + 1)
                if len(content) > maximum:
                    raise ValueError("Unexpected file size for " + path)
                return content
        except HTTPError as error:
            if error.code < 500 and error.code != 429:
                raise
            if attempt == 2:
                raise
        except (URLError, TimeoutError):
            if attempt == 2:
                raise
        time.sleep(attempt + 1)


def digest(content):
    return hashlib.sha256(content).hexdigest()


def allowed_path(name):
    path = PurePosixPath(name)
    if str(path) != name or path.is_absolute() or ".." in path.parts or "\\" in name:
        return False
    if name in {".gitignore", ".npmrc", ".openai/hosting.json"}:
        return True
    return all(not part.startswith(".") for part in path.parts) and path.parts[0] not in {
        "node_modules", "dist", "outputs", "upload",
    }


def load_file(name, entry):
    if "data" in entry:
        content = base64.b64decode(entry["data"], validate=True)
    elif name.startswith("public/"):
        content = download("/" + quote(name[len("public/"):]) + "?sync=" + entry["sha256"], entry["size"])
    else:
        raise ValueError("Missing source content for " + name)
    if len(content) != entry["size"] or digest(content) != entry["sha256"]:
        raise ValueError("Published file failed its integrity check: " + name)
    return name, content


def main():
    manifest = json.loads(download("/luma-source-sync/manifest.json", 12 * 1024 * 1024))
    if manifest.get("project") != PROJECT or manifest.get("schema") != 1:
        raise ValueError("Unexpected source manifest")
    files = manifest["files"]
    if not {"README.md", "package.json", "app/page.tsx", "worker/index.ts"} <= files.keys():
        raise ValueError("Incomplete source manifest")
    for name, entry in files.items():
        if not allowed_path(name) or not SHA256.fullmatch(entry["sha256"]) or not 0 <= entry["size"] <= MAX_FILE_SIZE:
            raise ValueError("Rejected source entry: " + name)

    previous = json.loads(STATE.read_text()) if STATE.is_file() else {}
    next_state = {name: entry["sha256"] for name, entry in files.items()}
    for name, old_hash in previous.items():
        if not allowed_path(name):
            raise ValueError("Invalid recorded source path")
        path = Path(name)
        if path.is_symlink() or not path.is_file() or digest(path.read_bytes()) != old_hash:
            raise ValueError("GitHub contains an independent change to " + name)

    pending = {}
    for name, entry in files.items():
        if previous.get(name) == entry["sha256"]:
            continue
        path = Path(name)
        if path.is_symlink() or any(parent.is_symlink() for parent in path.parents):
            raise ValueError("Refusing to write through a symlink: " + name)
        if name not in previous and path.exists():
            raise ValueError("A GitHub file already occupies " + name)
        pending[name] = entry

    if previous == next_state:
        print("GitHub already matches the published release.")
        return

    with ThreadPoolExecutor(max_workers=10) as workers:
        verified = dict(workers.map(lambda item: load_file(*item), pending.items()))

    for name, content in verified.items():
        path = Path(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    for name in previous.keys() - files.keys():
        Path(name).unlink()
    STATE.write_text(json.dumps(next_state, ensure_ascii=False, sort_keys=True, indent=2) + "\n")
    print(f"Verified {len(files)} files, updated {len(verified)}, removed {len(previous.keys() - files.keys())}.")


if __name__ == "__main__":
    main()
