"""Expose only page CSS/JS to staticfiles, never template HTML or Python."""
from django.conf import settings
from django.contrib.staticfiles.finders import BaseFinder
from django.core.files.storage import FileSystemStorage
from fnmatch import fnmatch


class PageAssetFinder(BaseFinder):
    storage = FileSystemStorage(location=settings.BASE_DIR / "templates")

    def list(self, ignore_patterns):
        root = (settings.BASE_DIR / "templates").resolve()
        for path in sorted(root.rglob("*")):
            relative = path.relative_to(root).as_posix()
            if (
                path.is_file()
                and path.suffix in {".css", ".js"}
                and path.resolve().is_relative_to(root)
                and not any(fnmatch(relative, pattern) for pattern in ignore_patterns)
            ):
                yield relative, self.storage

    def find(self, path, find_all=False, **kwargs):
        if kwargs.get("all") is not None:
            find_all = kwargs["all"]
        root = (settings.BASE_DIR / "templates").resolve()
        candidate = (root / path).resolve()
        if candidate.is_relative_to(root) and candidate.is_file() and candidate.suffix in {".css", ".js"}:
            return [str(candidate)] if find_all else str(candidate)
        # Finder implementations return an empty list for a miss, even when
        # find_all=False; Django's aggregate finder handles the final None.
        return []
