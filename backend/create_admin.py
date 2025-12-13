from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
import auth

def create_admin():
    db = SessionLocal()
    try:
        # Create tables if they don't exist (including the new column)
        models.Base.metadata.create_all(bind=engine)
        
        email = "admin@statpilot.com"
        password = "admin"
        
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            print(f"Admin user {email} already exists.")
            if not user.is_admin:
                user.is_admin = True
                db.commit()
                print("Updated existing user to admin.")
            return

        hashed_password = auth.get_password_hash(password)
        db_user = models.User(
            email=email, 
            hashed_password=hashed_password,
            is_admin=True,
            is_paid=True # Admins get paid features by default just in case
        )
        db.add(db_user)
        db.commit()
        print(f"Admin user created: {email} / {password}")
        
    except Exception as e:
        print(f"Error creating admin: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
