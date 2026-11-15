# Vercel frontend and Render backend

Import `Arijai2007/AgriTrace` into Vercel with the repository root as the project root and `main` as the production branch. The committed `vercel.json` supplies the build command and `client/dist` output directory. Vercel's GitHub integration deploys pushes automatically.

The frontend forwards `/api/*` to `https://agritrace-5ldg.onrender.com/api/*`. This preserves the existing sign-in, file upload, public trace and wallet transaction APIs without adding cross-origin browser requests. `/trace` and batch links load the React frontend, including on refresh.

Keep the existing Render Sepolia environment settings and server approval key on Render. Do not copy backend secrets into Vercel or sync the alternative demo Blueprint over the live backend. Render must also track `Arijai2007/AgriTrace` main for backend updates.

Connect MetaMask to the new frontend domain when prompted. Existing Sepolia records and the contract stay the same; QR codes generated from the frontend use its Vercel domain. A sleeping free Render service can delay the first API request.
