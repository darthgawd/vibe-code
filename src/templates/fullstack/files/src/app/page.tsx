/**
 * {{projectName}} - Home Page
 */

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>{{projectName}}</h1>
      <p>Your secure fullstack app is ready.</p>

      <h2>Next Steps</h2>
      <ul>
        <li>Review the security configuration in <code>next.config.js</code></li>
        <li>Add your API routes in <code>src/app/api/</code></li>
        <li>Set up your database connection</li>
        <li>Run <code>npm run dev</code> to start developing</li>
      </ul>

      <h2>Security Features</h2>
      <ul>
        <li>TypeScript strict mode enabled</li>
        <li>Zod for runtime validation</li>
        <li>CSP headers configured</li>
        <li>Environment variable validation</li>
      </ul>
    </main>
  );
}
