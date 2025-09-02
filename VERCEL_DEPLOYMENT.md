# Vercel Deployment Guide

This guide will help you deploy your Class Scheduling System to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Your project pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. Firebase service account credentials

## Step 1: Install Vercel CLI (Optional but Recommended)

```bash
npm install -g vercel
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel CLI

1. Login to Vercel:
```bash
vercel login
```

2. Deploy your project:
```bash
vercel
```

3. Follow the prompts:
   - Set up and deploy? `Y`
   - Which scope? (Choose your account)
   - Link to existing project? `N`
   - Project name: `class-scheduling-system` (or your preferred name)
   - Directory: `.` (current directory)
   - Override settings? `N`

### Option B: Deploy via Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Vercel will automatically detect it's a Node.js project

## Step 3: Configure Environment Variables

After deployment, you need to add your Firebase environment variables:

### Via Vercel CLI:
```bash
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_PRIVATE_KEY_ID
vercel env add FIREBASE_PRIVATE_KEY
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add FIREBASE_CLIENT_ID
vercel env add FIREBASE_AUTH_URI
vercel env add FIREBASE_TOKEN_URI
vercel env add FIREBASE_AUTH_PROVIDER_X509_CERT_URL
vercel env add FIREBASE_CLIENT_X509_CERT_URL
```

### Via Vercel Dashboard:

1. Go to your project dashboard
2. Click on "Settings" tab
3. Click on "Environment Variables"
4. Add each variable:

| Variable Name | Value |
|---------------|-------|
| `FIREBASE_PROJECT_ID` | `classscheduling-76744` |
| `FIREBASE_PRIVATE_KEY_ID` | `31dde917f36561bfe2c3d04b9bf15da6755f2518` |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCi35cooA3gmQP1\nA6wrwY0NRrANNZLqVhTPghARcBBR/KC+sVulPWLbku9PGudEm0yM9qlw/pobiFyH\n7Su+0tJ3n4Hj0KFVN+n77yOXYN5odgvFNCdgUOSGBRyXQXMIJUqv2V57noN0PYBc\nJwfyX8GrLTag/I8gi+7lRtneQJqHNVcXFnFuo18VMrgZUUzklyNEX7a+lCqf47U4\nWjejV1HZMHDD4lln/nStVAhO4Y3KilfXat1HyGTo5uqfbLQKfiAoeNzE+6AJ9Ltw\nfGOjZvaIRuGrRXZ02UZH8rk2JYXO5xYtG+PBzhc/8KwZ2iK2MNJW+fliKRNfdzKc\nSJ3l2qQnAgMBAAECggEAFvDlaqx4p+0FmKpGwvcFNhyByaqFIgqz7bKFLt+Y/ONX\nhOSYYwLtfL4KhRrl/kzdkHFh1m+WJ1Cir+ahJcSuLnlCI2OMheNVSs4ZNkZHrXEL\nIWDCNxfNyG7J4ygt2rTd+zzjyQe/vky3WsOIpAQG1GSO8EgCpPPw10yOfXaeDXMl\nHwme39/8HaGQPbvWDnbZcWNst3mOaXw+YQVbFXPH+3K29BAcN+W/jqLX5mSZElzC\nSWXw2CL3SrPL0yPeWm7J06k8nYONzTalLbN/jiLE22cGKxWiPJ4RJ+K3RZuuDQlo\nyJkp/WooiiqGzMl5/BFkxvnzfT7f4zbW19CCV7R9+QKBgQDhSUFLq0rRfu+kiE4I\no9ipHrc7FN2VDAK0l1k8P/QXpu/aj4488NN3cZ6tzDWgGJudz/9YTgg2gxhQXkC2\nGcur9+ylZUz1RvCQHgUtvXq+019mLdqm/OPCx+G2CyChknNpZuhVz4bQvKs7a9xQ\nVobxKTjGz2/yLAD6ahl/VRdZtQKBgQC5FA8OQoED57GmZw0W/CLYGUPr7W3C8nTu\nn4N9J5Jxp7x1EfA13k55b+PfwlwSxlIaOqniJ7V+BvyYrPMLDKXM8wjzNr6Fd8Pm\n3k13PxL877p79VayAnKJ6GZzyAPRxijNP7ouHTRV1wWg17GXUNgH8E6CmqUFE+HD\n3gF3lND/6wKBgQCNjDJbcdeDg2bckMu+v/uMXwEvPO/wCujUQNfPdDtQdRH02Ae9\noG6teJUDi/ARlASKhjpgaD7eyUWIkX/FKrX+abqlPN26qoTReBs23vt1VGd3Us4z\n52bPZjkZ4SnyeorLKd5GtCp3kmNf5Wg6jfMhKQ5EU+d5WE6RCALXL0aJlQKBgBvJ\nHiWG6HWcoDgaOoXb3qNQz7io0ZS178YvXn84pKy5gPqWcdi0glWK7cwXEtmiuorD\nieOxEHdWNy/4rxhWksG9LvfMnTfObjPH5htj9cbRes7HW3eoFGgN4uu4+JHSzSdb\nTOlFaykD+g1WtIvCEFzIwBCthN7JSFiuiMvaJLJ3AoGATBdn1oT0XgrWhFX6DdNr\nnj22vSPo4ol9yJ23ysxVmFAcAcgbrRAKWu2QLCUjZHcn7rkxC0npkKjXVX6QJHfk\n0juN+SClrbjRXIo3mHiUdZVljKJG2NcT52akBQFz2nNTpoWpVvu6qfl5aZGuKkos\nunQYm6p4VJCduiF12ZMIuWw=\n-----END PRIVATE KEY-----\n` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@classscheduling-76744.iam.gserviceaccount.com` |
| `FIREBASE_CLIENT_ID` | `100254065616493564211` |
| `FIREBASE_AUTH_URI` | `https://accounts.google.com/o/oauth2/auth` |
| `FIREBASE_TOKEN_URI` | `https://oauth2.googleapis.com/token` |
| `FIREBASE_AUTH_PROVIDER_X509_CERT_URL` | `https://www.googleapis.com/oauth2/v1/certs` |
| `FIREBASE_CLIENT_X509_CERT_URL` | `https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40classscheduling-76744.iam.gserviceaccount.com` |

## Step 4: Redeploy

After adding environment variables, redeploy your project:

### Via CLI:
```bash
vercel --prod
```

### Via Dashboard:
Click "Redeploy" in your project dashboard.

## Step 5: Test Your Deployment

1. Visit your deployed URL (provided by Vercel)
2. Test the health endpoint: `https://your-app.vercel.app/api/health`
3. Test the frontend: `https://your-app.vercel.app/`

## Important Notes

1. **Environment Variables**: Make sure all Firebase environment variables are set correctly in Vercel
2. **CORS**: The API is configured to allow all origins in production
3. **Rate Limiting**: 100 requests per 15 minutes per IP
4. **Function Timeout**: 30 seconds maximum for API functions
5. **Static Files**: Frontend files are served from the `public` directory

## Troubleshooting

### Common Issues:

1. **Firebase Connection Error**: Check that all environment variables are set correctly
2. **CORS Issues**: The API allows all origins, but check browser console for errors
3. **Function Timeout**: Complex scheduling operations might timeout; consider optimizing algorithms
4. **Build Errors**: Check Vercel build logs for dependency issues

### Debug Commands:

```bash
# Check environment variables
vercel env ls

# View deployment logs
vercel logs

# Test locally with Vercel
vercel dev
```

## Next Steps

1. Set up a custom domain (optional)
2. Configure monitoring and analytics
3. Set up automatic deployments from your Git repository
4. Consider implementing caching for better performance

Your Class Scheduling System should now be live on Vercel! 🚀
