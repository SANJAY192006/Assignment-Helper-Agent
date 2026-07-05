import os
os.environ['TESTING'] = 'true'

import unittest
import json
from app import app, db, User

class TestEduAssistApp(unittest.TestCase):
    def setUp(self):
        # Configure app for testing
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        self.app = app.test_client()
        
        # Initialize database with a clean state
        with app.app_context():
            db.drop_all()
            db.create_all()
            # Add a test user
            self.test_user = User(username="Kumar", email="kumar@test.com")
            self.test_user.set_password("Kumar1234")
            db.session.add(self.test_user)
            db.session.commit()

    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()

    def login_client(self):
        """Helper to log in the test client"""
        with self.app.session_transaction() as sess:
            sess['logged_in'] = True
            sess['username'] = 'Kumar'
            sess['user_id'] = 1

    def test_homepage_redirects_to_login(self):
        """Test that the homepage redirects to login when not logged in"""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login', response.location)

    def test_homepage_redirects_to_form_when_logged_in(self):
        """Test that the homepage redirects to /form when logged in"""
        self.login_client()
        response = self.app.get('/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/form', response.location)

    def test_login_page_loads(self):
        """Test that login page loads successfully"""
        response = self.app.get('/login')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'EduAssist AI', response.data)

    def test_login_successful(self):
        """Test that correct credentials logs in the user"""
        response = self.app.post('/login',
                                 data=json.dumps({
                                     "username": "Kumar",
                                     "password": "Kumar1234"
                                 }),
                                 content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'success')

    def test_login_failed(self):
        """Test that incorrect credentials yields unauthorized error"""
        response = self.app.post('/login',
                                 data=json.dumps({
                                     "username": "Kumar",
                                     "password": "wrong_password"
                                 }),
                                 content_type='application/json')
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertIn('error', data)

    def test_generate_missing_fields(self):
        """Test that generating without fields yields 400 validation error"""
        self.login_client()
        orig_key = os.environ.get("GEMINI_API_KEY")
        os.environ["GEMINI_API_KEY"] = "dummy_key"
        
        try:
            response = self.app.post('/generate', 
                                     data=json.dumps({}),
                                     content_type='application/json')
            self.assertEqual(response.status_code, 400)
            data = json.loads(response.data)
            self.assertIn('error', data)
            self.assertIn('required', data['error'].lower())
        finally:
            if orig_key is not None:
                os.environ["GEMINI_API_KEY"] = orig_key
            elif "GEMINI_API_KEY" in os.environ:
                del os.environ["GEMINI_API_KEY"]

    def test_generate_missing_api_key(self):
        """Test that generating without configured API key yields 500 error"""
        self.login_client()
        orig_key = os.environ.get("GEMINI_API_KEY")
        if "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]
        
        try:
            response = self.app.post('/generate', 
                                     data=json.dumps({
                                         "subject": "Python",
                                         "topic": "Lists",
                                         "question": "Explain lists and coding examples."
                                     }),
                                     content_type='application/json')
            
            self.assertEqual(response.status_code, 500)
            data = json.loads(response.data)
            self.assertIn('error', data)
            self.assertIn('API key is not configured', data['error'])
        finally:
            if orig_key is not None:
                os.environ["GEMINI_API_KEY"] = orig_key

if __name__ == '__main__':
    unittest.main()

