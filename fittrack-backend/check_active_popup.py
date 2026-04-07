from database import SessionLocal
from models import Post
from datetime import datetime
from sqlalchemy import or_

def check_active_popup():
    db = SessionLocal()
    try:
        now = datetime.now()
        print(f"Current Time: {now}")
        
        # 1. 모든 팝업 게시글 조회
        all_popups = db.query(Post).filter(Post.is_popup == True).all()
        print(f"Total Popups found: {len(all_popups)}")
        for p in all_popups:
            print(f" - ID: {p.id}, Title: {p.title}, Expires: {p.popup_expires_at}")

        # 2. 로직과 동일한 쿼리 테스트
        popup = db.query(Post).filter(
            Post.is_popup == True,
            or_(Post.popup_expires_at == None, Post.popup_expires_at > now)
        ).order_by(Post.id.desc()).first()
        
        if popup:
            print(f"✅ Active Popup Found: ID={popup.id}, Title='{popup.title}'")
        else:
            print("❌ No Active Popup found matching criteria.")

    finally:
        db.close()

if __name__ == "__main__":
    check_active_popup()
