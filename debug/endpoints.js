export function endpointDisplay(baseURL, NODE_ENV) {
  console.log("\n📚 Available endpoints:");
  console.log(`   GET  ${baseURL}/                    - API Info`);
  console.log(`   GET  ${baseURL}/health             - Health Check`);
  console.log(
    `   POST ${baseURL}/api/auth/login     - Login (Admin: ${process.env.ADMIN_EMAIL || "check environment"})`
  );
  console.log(`   POST ${baseURL}/api/contact        - Contact Form`);
  console.log(`   ALL  ${baseURL}/api/dashboard/*    - Dashboard API (Auth Required)`);
  console.log(`   ALL  ${baseURL}/api/oauth/*        - OAuth Authentication`);

  // OAuth URLs für Provider-Konfiguration anzeigen
  if (NODE_ENV === "production") {
    console.log("\n🔐 OAuth Callback URLs für Provider-Setup:");
    console.log(`   Google: ${baseURL}/api/oauth/google/callback`);
    console.log(`   GitHub: ${baseURL}/api/oauth/github/callback`);
    console.log("\n⚠️  WICHTIG: Aktualisiere diese URLs in:");
    console.log("   - Google Cloud Console → OAuth 2.0 Client IDs");
    console.log("   - GitHub → Developer settings → OAuth Apps");
  }

  console.log("\n📬 Newsletter endpoints:");
  console.log(`   POST ${baseURL}/api/newsletter/subscribe        - Public Newsletter Signup`);
  console.log(`   GET  ${baseURL}/api/newsletter/subscribers      - Admin: Get Subscribers`);
  console.log(`   GET  ${baseURL}/api/newsletter/templates        - Admin: Get Templates`);
  console.log(`   POST ${baseURL}/api/newsletter/templates        - Admin: Create Template`);
  console.log(`   GET  ${baseURL}/api/newsletter/stats            - Admin: Statistics`);

  if (NODE_ENV === "development") {
    console.log("\n🛠️  Development endpoints:");
    console.log(`   GET  ${baseURL}/debug/env         - Environment Check`);
    console.log(`   POST ${baseURL}/api/contact/test   - Contact Test`);
    console.log(`   GET  ${baseURL}/debug/cors-test   - CORS Test`);
  }

  console.log(`\n🎯 Frontend should connect to: ${baseURL}/api`);
  console.log(`🔗 Test health check: curl ${baseURL}/health`);
  console.log(`🔗 Test admin login: POST ${baseURL}/api/auth/login`);
  console.log(
    '   Body: {"email": "' + (process.env.ADMIN_EMAIL || "your@email.com") + '", "password": "your_password"}'
  );

  // Deployment-spezifische Informationen
  if (process.env.NODE_ENV === "production") {
    console.log("\n🌐 PRODUCTION DEPLOYMENT INFO:");
    console.log(`   - Backend URL: ${baseURL}`);
    console.log(`   - Frontend URL: ${process.env.FRONTEND_URL || "https://portfolio-chris-schubert.vercel.app"}`);
    // console.log(`   - CORS Origins: ${JSON.stringify(corsOptions.origin)}`);
  }

  console.log("\n✨ Ready to receive requests!\n");
}
