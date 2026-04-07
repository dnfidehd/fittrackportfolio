from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Literal
import math
import urllib.parse
import urllib.request
import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


router = APIRouter(prefix="/api/open-percentile", tags=["Open Percentile"])

LEADERBOARD_BASE_URL = "https://c3po.crossfit.com/api/competitions/v2/competitions/open/{year}/leaderboards"
DIVISION_BY_GENDER = {
    "male": 1,
    "female": 2,
}

_CACHE: dict[tuple[int, str, int, bool, str], dict[str, Any]] = {}
_CACHE_TTL = timedelta(minutes=20)


class ComparableScore(BaseModel):
    kind: Literal["time", "reps"]
    value: float


class OpenPercentileEstimateRequest(BaseModel):
    year: int
    event: int
    gender: Literal["male", "female"] = "male"
    is_rx: bool = True
    country: str = "KR"
    score_mode: Literal["time", "reps"] = "reps"
    score_value: str


class OpenPercentileEstimateResponse(BaseModel):
    year: int
    event: int
    gender: Literal["male", "female"]
    is_rx: bool
    country: str
    total_competitors: int
    estimated_rank: int
    percentile: float
    top_percent: float
    sampled_rows: int
    sampled_at: str
    note: str


def _parse_input_score(mode: str, raw_score: str) -> ComparableScore:
    value = raw_score.strip().lower().replace("reps", "").replace("rep", "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="점수를 입력해주세요.")

    if mode == "time":
        if ":" not in value:
            raise HTTPException(status_code=400, detail="시간 기록은 MM:SS 형식으로 입력해주세요.")
        minute_str, second_str = value.split(":", 1)
        minutes = int(minute_str)
        seconds = int(second_str)
        return ComparableScore(kind="time", value=minutes * 60 + seconds)

    return ComparableScore(kind="reps", value=float(value))


def _parse_display_score(score_display: str) -> ComparableScore | None:
    if not score_display:
        return None

    cleaned = score_display.strip().lower()
    if ":" in cleaned:
        digits = cleaned.split(":")
        try:
            minutes = int(digits[0])
            seconds = int(digits[1])
            return ComparableScore(kind="time", value=minutes * 60 + seconds)
        except ValueError:
            return None

    digits = "".join(ch for ch in cleaned if ch.isdigit() or ch == ".")
    if not digits:
        return None

    try:
        return ComparableScore(kind="reps", value=float(digits))
    except ValueError:
        return None


def _is_valid_event_display(score_display: str, is_rx: bool) -> bool:
    if not score_display:
        return False

    cleaned = score_display.strip().lower()
    if is_rx and " - " in cleaned:
        return False
    return True


def _score_compare(a: ComparableScore, b: ComparableScore) -> int:
    if a.kind != b.kind:
        return -1 if a.kind == "time" else 1

    if a.kind == "time":
        if a.value < b.value:
            return -1
        if a.value > b.value:
            return 1
        return 0

    if a.value > b.value:
        return -1
    if a.value < b.value:
        return 1
    return 0


def _interpolate_rank(left: dict[str, Any], right: dict[str, Any], candidate: ComparableScore) -> int:
    left_rank = left["rank"]
    right_rank = right["rank"]
    left_score: ComparableScore = left["score"]
    right_score: ComparableScore = right["score"]

    if left_score.kind != right_score.kind or left_score.kind != candidate.kind:
        return max(1, round((left_rank + right_rank) / 2))

    if candidate.kind == "time":
        denominator = right_score.value - left_score.value
        if denominator <= 0:
            return left_rank
        ratio = (candidate.value - left_score.value) / denominator
    else:
        denominator = left_score.value - right_score.value
        if denominator <= 0:
            return left_rank
        ratio = (left_score.value - candidate.value) / denominator

    ratio = max(0.0, min(1.0, ratio))
    return max(1, round(left_rank + ratio * (right_rank - left_rank)))


def _sample_pages(total_pages: int) -> list[int]:
    if total_pages <= 12:
        return list(range(1, total_pages + 1))

    page_set = {1, total_pages}
    intervals = 10
    for idx in range(intervals + 1):
        page = 1 + round((total_pages - 1) * idx / intervals)
        page_set.add(page)

    dense_edges = [2, 3, 4, total_pages - 1, total_pages - 2, total_pages - 3]
    for page in dense_edges:
        if 1 <= page <= total_pages:
            page_set.add(page)

    return sorted(page_set)


def _count_valid_rows(page_data: dict[str, Any], event: int, is_rx: bool) -> int:
    count = 0
    for row in page_data.get("leaderboardRows", []):
        scores = row.get("scores") or []
        if len(scores) < event:
            continue
        event_score = scores[event - 1]
        if _is_valid_event_display(event_score.get("scoreDisplay", ""), is_rx):
            count += 1
    return count


def _find_last_valid_page(
    year: int,
    gender: str,
    event: int,
    is_rx: bool,
    country: str,
    total_pages: int,
    fetched_pages: dict[int, dict[str, Any]],
) -> int:
    low = 1
    high = total_pages
    last_valid = 0

    while low <= high:
        mid = (low + high) // 2
        page_data = fetched_pages.get(mid) or _fetch_page(year, gender, mid, is_rx, country, event)
        fetched_pages[mid] = page_data
        valid_count = _count_valid_rows(page_data, event, is_rx)
        if valid_count > 0:
            last_valid = mid
            low = mid + 1
        else:
            high = mid - 1

    return last_valid


def _fetch_page(year: int, gender: str, page: int, is_rx: bool, country: str, sort: int) -> dict[str, Any]:
    params = urllib.parse.urlencode({
        "view": 0,
        "division": DIVISION_BY_GENDER[gender],
        "scaled": 0 if is_rx else 1,
        "sort": sort,
        "country": country,
        "page": page,
    })
    url = f"{LEADERBOARD_BASE_URL.format(year=year)}?{params}"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def _load_event_samples(year: int, gender: str, event: int, is_rx: bool, country: str) -> dict[str, Any]:
    cache_key = (year, gender, event, is_rx, country)
    cached = _CACHE.get(cache_key)
    now = datetime.utcnow()
    if cached and now - cached["loaded_at"] < _CACHE_TTL:
        return cached

    first_page = _fetch_page(year, gender, 1, is_rx, country, event)
    pagination = first_page.get("pagination") or {}
    total_pages = int(pagination.get("totalPages") or 0)
    total_competitors = int(pagination.get("totalCompetitors") or 0)
    if total_pages <= 0 or total_competitors <= 0:
        raise HTTPException(status_code=404, detail="해당 조건의 Open 리더보드 데이터를 찾지 못했습니다.")

    sampled_rows: list[dict[str, Any]] = []
    target_pages = _sample_pages(total_pages)
    fetched_pages = {1: first_page}
    last_valid_page = _find_last_valid_page(year, gender, event, is_rx, country, total_pages, fetched_pages)
    if last_valid_page <= 0:
        raise HTTPException(status_code=404, detail="해당 조건의 유효한 이벤트 점수를 찾지 못했습니다.")

    last_page_data = fetched_pages[last_valid_page]
    page_size = len(last_page_data.get("leaderboardRows", []))
    valid_on_last_page = _count_valid_rows(last_page_data, event, is_rx)
    total_competitors = ((last_valid_page - 1) * page_size) + valid_on_last_page

    target_pages = [page for page in target_pages if page <= last_valid_page]
    if last_valid_page not in target_pages:
        target_pages.append(last_valid_page)
    target_pages = sorted(set(target_pages))

    for page in target_pages:
        page_data = fetched_pages.get(page) or _fetch_page(year, gender, page, is_rx, country, event)
        fetched_pages[page] = page_data
        leaderboard_rows = page_data.get("leaderboardRows", [])
        page_size = len(leaderboard_rows)
        for row_index, row in enumerate(leaderboard_rows):
            scores = row.get("scores") or []
            if len(scores) < event:
                continue
            event_score = scores[event - 1]
            score_display = event_score.get("scoreDisplay", "")
            if not _is_valid_event_display(score_display, is_rx):
                continue
            parsed_score = _parse_display_score(event_score.get("scoreDisplay", ""))
            if not parsed_score:
                continue

            # The API exposes global event rank inside scores[event-1].rank.
            # For KR percentile we need the country-filtered event order, which
            # is represented by the page ordering when sort=<event>.
            local_rank = ((page - 1) * page_size) + row_index + 1
            sampled_rows.append({
                "rank": local_rank,
                "score": parsed_score,
                "display": score_display,
            })

    sampled_rows.sort(key=lambda item: item["rank"])

    deduped: list[dict[str, Any]] = []
    seen_ranks: set[int] = set()
    for row in sampled_rows:
        if row["rank"] in seen_ranks:
            continue
        seen_ranks.add(row["rank"])
        deduped.append(row)

    payload = {
        "total_competitors": total_competitors,
        "samples": deduped,
        "loaded_at": now,
    }
    _CACHE[cache_key] = payload
    return payload


@router.post("/estimate", response_model=OpenPercentileEstimateResponse)
def estimate_open_percentile(request: OpenPercentileEstimateRequest):
    if request.event not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="현재는 Open event 1~3만 지원합니다.")

    candidate = _parse_input_score(request.score_mode, request.score_value)
    sampled = _load_event_samples(
        year=request.year,
        gender=request.gender,
        event=request.event,
        is_rx=request.is_rx,
        country=request.country,
    )

    samples = sampled["samples"]
    total_competitors = sampled["total_competitors"]
    if not samples:
        raise HTTPException(status_code=404, detail="순위 추정에 필요한 표본 데이터를 불러오지 못했습니다.")

    estimated_rank = total_competitors

    best_sample = samples[0]
    worst_sample = samples[-1]
    if _score_compare(candidate, best_sample["score"]) <= 0:
        estimated_rank = 1 if _score_compare(candidate, best_sample["score"]) < 0 else best_sample["rank"]
    elif _score_compare(candidate, worst_sample["score"]) >= 0:
        estimated_rank = total_competitors if _score_compare(candidate, worst_sample["score"]) > 0 else worst_sample["rank"]
    else:
        for left, right in zip(samples, samples[1:]):
            if _score_compare(left["score"], candidate) <= 0 and _score_compare(candidate, right["score"]) <= 0:
                estimated_rank = _interpolate_rank(left, right, candidate)
                break

    estimated_rank = max(1, min(total_competitors, estimated_rank))
    percentile = round((estimated_rank / total_competitors) * 100, 2)
    top_percent = round(((estimated_rank - 1) / total_competitors) * 100, 2)

    return OpenPercentileEstimateResponse(
        year=request.year,
        event=request.event,
        gender=request.gender,
        is_rx=request.is_rx,
        country=request.country,
        total_competitors=total_competitors,
        estimated_rank=estimated_rank,
        percentile=percentile,
        top_percent=top_percent,
        sampled_rows=len(samples),
        sampled_at=sampled["loaded_at"].isoformat(),
        note="CrossFit Games KR leaderboard sample pages based approximation. Actual rank may differ slightly.",
    )
