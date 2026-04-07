# Migration Guide: Switching from competitions.py to competitions_new

## Overview
This guide explains how to migrate from the monolithic `competitions.py` file to the new modular `competitions_new/` structure.

## Step 1: Update Main Router Import

### Before (Old Structure)
```python
# In your main app.py or routers/__init__.py
from routers.competitions import router as competitions_router

app.include_router(competitions_router)
```

### After (New Structure)
```python
# In your main app.py or routers/__init__.py
from routers.competitions_new import router as competitions_router

app.include_router(competitions_router)
```

## Step 2: Verify No Changes Needed for API Consumers

**Good news**: All API endpoints remain identical. No changes needed for:
- Frontend code
- Mobile apps
- Third-party integrations
- API documentation

All endpoints continue to work at the same paths:
```
POST   /competitions/
GET    /competitions/
GET    /competitions/{id}
PUT    /competitions/{id}
DELETE /competitions/{id}
GET    /competitions/pending-count
... etc
```

## Step 3: Update Tests (If Applicable)

### Old Test Structure
```python
from routers.competitions import create_competition, get_competitions
from routers.competitions import router

def test_create_competition():
    pass
```

### New Test Structure
```python
# Option 1: Import from specific modules
from routers.competitions_new.competitions import create_competition, get_competitions
from routers.competitions_new.competitions import router

# Option 2: Import from __init__.py (combined router)
from routers.competitions_new import router

def test_create_competition():
    pass
```

### Testing Individual Modules
```python
# Test competitions module
from routers.competitions_new import competitions
assert hasattr(competitions, 'router')

# Test leaderboard calculations
from routers.competitions_new.leaderboard import get_event_leaderboard

# Test helper functions
from routers.competitions_new.helpers import anonymize_name, parse_score
```

## Step 4: Database & Model Compatibility

**No changes needed**. All modules use the same:
- Models from `models.py`
- Schemas from `schemas.py`
- Database session from `database.py`
- Authentication from `security.py`

## Step 5: Update Documentation

If you have internal documentation referencing the old file structure:

### Update File References
```
# Old
docs/api/competitions-endpoints.md
routers/competitions.py (1749 lines)

# New
docs/api/competitions-endpoints.md (same content)
routers/competitions_new/ (modular structure)
  ├── competitions.py
  ├── events.py
  ├── leaderboard.py
  ├── registrations.py
  ├── gym_management.py
  ├── guest_access.py
  ├── scores.py
  └── excel.py
```

### Update Code References
```
# Old
See routers/competitions.py line 542 for score submission logic

# New
See routers/competitions_new/scores.py line 42 for score submission logic
```

## Step 6: Gradual Migration (Optional)

If you want to keep both structures temporarily:

```python
# In routers/__init__.py
try:
    # Try new structure first
    from routers.competitions_new import router as competitions_router
except ImportError:
    # Fall back to old structure
    from routers.competitions import router as competitions_router

app.include_router(competitions_router)
```

## Step 7: Remove Old File (When Ready)

Once everything is working with the new structure:

```bash
# Backup the old file (optional)
cp routers/competitions.py routers/competitions.py.backup

# Remove the old file
rm routers/competitions.py
```

## Troubleshooting

### Issue: ImportError when importing from competitions_new
**Solution**: Ensure you're in the correct directory and Python path includes the project root.

```bash
# Test imports
python3 -c "from routers.competitions_new import router; print('Success!')"
```

### Issue: Router not combining endpoints
**Solution**: Check that all sub-modules are properly included in `__init__.py`:

```python
# In __init__.py, verify all routers are included
router.include_router(competitions.router)
router.include_router(events.router)
# ... all 8 modules
```

### Issue: Missing modules or syntax errors
**Solution**: Verify all files were created:

```bash
ls -la routers/competitions_new/
```

Should show:
```
__init__.py
competitions.py
events.py
leaderboard.py
registrations.py
gym_management.py
guest_access.py
scores.py
excel.py
helpers.py
REFACTORING.md
MIGRATION_GUIDE.md
```

## Verification Checklist

- [ ] Backup original `competitions.py` file
- [ ] Create `routers/competitions_new/` directory
- [ ] Create all 10 files (9 modules + 1 __init__.py)
- [ ] Update main app router import
- [ ] Test API endpoints (all should work)
- [ ] Update internal documentation
- [ ] Update test files
- [ ] Verify no broken imports
- [ ] Remove old `competitions.py` (optional)

## Benefits of Migration

1. **Better Code Organization**: Each concern is in its own module
2. **Easier Maintenance**: Smaller files are easier to understand and modify
3. **Improved Testability**: Can test individual modules in isolation
4. **Reduced Merge Conflicts**: Multiple developers can work on different modules
5. **Better Performance**: Only load what you need (lazy loading possible)
6. **Cleaner Imports**: Dependencies are explicit
7. **Scalability**: Easy to add new modules as features grow

## Performance Impact

**Negligible to None**:
- All endpoints loaded at startup (same as before)
- No additional database queries
- Same CPU/memory usage
- No latency differences
- Same response times

## Rollback Plan

If you need to revert:

```bash
# Option 1: Keep old file as backup
cp routers/competitions.py.backup routers/competitions.py

# Option 2: Git revert
git checkout HEAD -- routers/competitions.py

# Update import in main app
from routers.competitions import router
```

## Questions & Support

If you encounter issues:

1. Check `REFACTORING.md` for module descriptions
2. Verify file structure with `ls -la routers/competitions_new/`
3. Test individual imports
4. Check Python syntax with `python3 -m py_compile routers/competitions_new/*.py`

---

**Last Updated**: 2024
**Compatibility**: Python 3.8+, FastAPI 0.68+, SQLAlchemy 1.4+
