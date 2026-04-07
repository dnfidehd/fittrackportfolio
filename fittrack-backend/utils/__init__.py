# Utils package for FitTrack Backend
from .auth import (
    require_admin,
    require_coach,
    require_admin_or_coach,
    require_superadmin,
    check_gym_access,
    assert_gym_access,
)
from .errors import get_or_404, not_found_error, forbidden_error, bad_request_error, conflict_error
from .validators import (
    parse_date,
    validate_date_range,
    validate_positive_integer,
    validate_non_negative_integer,
    validate_string_not_empty,
)
from .rate_limit import (
    check_failed_attempt_lock,
    check_rate_limit,
    resolve_client_ip,
    clear_rate_limit_storage,
    register_failed_attempt,
    reset_failed_attempts,
)
from .pagination import paginate, paginate_with_response, PaginationParams, get_page_info
from .query import (
    filter_by_gym,
    filter_active_members,
    filter_by_date_range,
    filter_by_status,
    filter_by_boolean,
)
from .helpers import (
    parse_score,
    anonymize_name,
    mask_phone_number,
    mask_email,
    format_time_seconds,
    format_weight,
)
from .health import check_database_connection
from .transaction import (
    transactional,
    TransactionContext,
    with_transaction,
    SavePoint,
    TransactionLogger,
    atomic_update,
    atomic_bulk_update,
    atomic_delete_cascade,
    is_in_transaction,
    get_transaction_status,
)

__all__ = [
    # Auth
    "require_admin",
    "require_coach",
    "require_admin_or_coach",
    "require_superadmin",
    "check_gym_access",
    "assert_gym_access",
    # Errors
    "get_or_404",
    "not_found_error",
    "forbidden_error",
    "bad_request_error",
    "conflict_error",
    # Validators
    "parse_date",
    "validate_date_range",
    "validate_positive_integer",
    "validate_non_negative_integer",
    "validate_string_not_empty",
    "check_rate_limit",
    "check_failed_attempt_lock",
    "resolve_client_ip",
    "clear_rate_limit_storage",
    "register_failed_attempt",
    "reset_failed_attempts",
    # Pagination
    "paginate",
    "paginate_with_response",
    "PaginationParams",
    "get_page_info",
    # Query
    "filter_by_gym",
    "filter_active_members",
    "filter_by_date_range",
    "filter_by_status",
    "filter_by_boolean",
    # Helpers
    "parse_score",
    "anonymize_name",
    "mask_phone_number",
    "mask_email",
    "format_time_seconds",
    "format_weight",
    "check_database_connection",
    # Transaction
    "transactional",
    "TransactionContext",
    "with_transaction",
    "SavePoint",
    "TransactionLogger",
    "atomic_update",
    "atomic_bulk_update",
    "atomic_delete_cascade",
    "is_in_transaction",
    "get_transaction_status",
]
