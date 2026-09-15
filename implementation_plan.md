# Deployment Implementation Plan

## User Review Required

> [!WARNING]
> **Important Database Limitation on Render (Free Tier)**
> You chose SQLite for Render.com. Please note that **Render's Free Web Services use ephemeral storage**. This means every time your app restarts, goes to sleep, or redeploys, **all SQLite database data will be erased**!
> 
> To keep your data permanently on Render, you have two options:
> 1. Use **Render's Free PostgreSQL database** instead of SQLite (Recommended for production).
> 2. Add a **Persistent Disk** to your Render Web Service (costs about $0.25/month).

## Proposed Changes

I have already updated the `README.md` with complete instructions on how to run locally and deploy to GitHub Pages and Render.

I will now create a `render.yaml` Blueprint file. This is an Infrastructure-as-Code file that allows you to deploy to Render with a single click without manually configuring settings.

### backend
#### [NEW] [render.yaml](file:///C:/Users/shara/Desktop/darul-aman-website%20New/render.yaml)
I will create a `render.yaml` file in the root directory. This file will instruct Render to:
- Create a Web Service for the Node.js backend.
- Run `npm install`, generate Prisma client, push the schema, and seed the database during the build phase.
- Start the server using `npm start`.
- Set up necessary environment variables.

### portal/js
#### [MODIFY] [config.js](file:///C:/Users/shara/Desktop/darul-aman-website%20New/portal/js/config.js)
I will update the instructions in `config.js` to remind you to change the `API_BASE_URL` after you deploy to Render.

## Verification Plan
1. Ensure `render.yaml` is correctly formatted according to Render's blueprint specifications.
2. Ensure the `README.md` correctly explains the deployment process.
3. Help you initialize the git repository and commit the files if you haven't already.

Are you okay with this plan, and do you acknowledge the SQLite limitation on Render's free tier?
