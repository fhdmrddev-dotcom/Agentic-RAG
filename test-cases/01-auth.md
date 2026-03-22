# TC-01: Authentication

## TC-01-01 — Sign Up with new account

**GIVEN** the app is open and no user is logged in
**WHEN** I navigate to the Sign Up page and enter a valid email + password
**THEN**
- Account is created in Supabase Auth
- I am redirected to the main chat interface
- No error messages appear

---

## TC-01-02 — Sign Up with existing email

**GIVEN** an account already exists for the email address
**WHEN** I attempt to sign up with the same email
**THEN**
- An error message is shown ("User already registered" or similar)
- I am not logged in or redirected

---

## TC-01-03 — Sign In with valid credentials

**GIVEN** an existing account
**WHEN** I enter the correct email and password and click Sign In
**THEN**
- I am taken to the main chat interface
- The sidebar is visible with a "New Chat" button

---

## TC-01-04 — Sign In with wrong password

**GIVEN** an existing account
**WHEN** I enter the wrong password
**THEN**
- An error message is shown
- I remain on the sign-in page

---

## TC-01-05 — Session persistence across page reload

**GIVEN** I am signed in
**WHEN** I hard-refresh the browser (Ctrl+Shift+R)
**THEN**
- I am still signed in
- My thread list is still visible
- I do not see the sign-in page

---

## TC-01-06 — Sign Out

**GIVEN** I am signed in
**WHEN** I click the Sign Out button in the sidebar
**THEN**
- I am redirected to the sign-in page
- Navigating back does not restore the session

---

## TC-01-07 — Data isolation between users

**GIVEN** two separate accounts (User A and User B) each with uploaded documents
**WHEN** User B signs in
**THEN**
- User B sees only their own threads and documents
- User A's data is not visible
