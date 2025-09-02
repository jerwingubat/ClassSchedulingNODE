# Firebase Environment Setup Guide

## Step 1: Create your .env file

Create a `.env` file in your project root directory with the following content:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=classscheduling-76744
FIREBASE_PRIVATE_KEY_ID=your_private_key_id_here
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@classscheduling-76744.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id_here
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40classscheduling-76744.iam.gserviceaccount.com

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

## Step 2: Get your Firebase Service Account Credentials

1. Go to your [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `classscheduling-76744`
3. Click on the gear icon (⚙️) and select "Project settings"
4. Go to the "Service accounts" tab
5. Click "Generate new private key"
6. Download the JSON file

## Step 3: Extract the values from the JSON file

From the downloaded JSON file, extract these values and replace the placeholders in your `.env` file:

- `private_key_id` → `FIREBASE_PRIVATE_KEY_ID`
- `private_key` → `FIREBASE_PRIVATE_KEY` (keep the quotes and newlines)
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `client_id` → `FIREBASE_CLIENT_ID`
- `auth_uri` → `FIREBASE_AUTH_URI`
- `token_uri` → `FIREBASE_TOKEN_URI`
- `auth_provider_x509_cert_url` → `FIREBASE_AUTH_PROVIDER_X509_CERT_URL`
- `client_x509_cert_url` → `FIREBASE_CLIENT_X509_CERT_URL`

## Step 4: Example of a complete .env file

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=classscheduling-76744
FIREBASE_PRIVATE_KEY_ID=abc123def456ghi789
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc123@classscheduling-76744.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789012345678901
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-abc123%40classscheduling-76744.iam.gserviceaccount.com

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

## Step 5: Set up Firestore Security Rules

In your Firebase Console, go to Firestore Database and set up these security rules for development:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // For development only
    }
  }
}
```

**⚠️ Important Security Note:** The above rule allows all read/write access. For production, you should implement proper authentication and authorization rules.

## Step 6: Test your setup

1. Start your server: `npm run dev`
2. Check the console for any Firebase connection errors
3. Visit `http://localhost:3000` to test the application

## Troubleshooting

### Common Issues:

1. **"Firebase Admin SDK not initialized"**
   - Check that all environment variables are set correctly
   - Ensure the private key includes the `\n` characters for line breaks

2. **"Permission denied"**
   - Verify your Firestore security rules
   - Check that the service account has the correct permissions

3. **"Project not found"**
   - Verify the `FIREBASE_PROJECT_ID` matches your Firebase project ID exactly

### Environment Variable Validation

Your `.env` file should have exactly these variables:
- ✅ FIREBASE_PROJECT_ID
- ✅ FIREBASE_PRIVATE_KEY_ID  
- ✅ FIREBASE_PRIVATE_KEY
- ✅ FIREBASE_CLIENT_EMAIL
- ✅ FIREBASE_CLIENT_ID
- ✅ FIREBASE_AUTH_URI
- ✅ FIREBASE_TOKEN_URI
- ✅ FIREBASE_AUTH_PROVIDER_X509_CERT_URL
- ✅ FIREBASE_CLIENT_X509_CERT_URL
- ✅ PORT
- ✅ NODE_ENV
- ✅ CORS_ORIGIN

## Next Steps

Once your `.env` file is configured:

1. Run `npm install` to install dependencies
2. Run `npm run dev` to start the development server
3. Open `http://localhost:3000` in your browser
4. Test creating departments, teachers, subjects, and generating schedules

Your class scheduling system should now be fully functional with Firebase Firestore as the backend database!
