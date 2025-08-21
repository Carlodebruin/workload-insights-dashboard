export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Page - Basic Routing</h1>
      <p>If you can see this, Next.js routing is working correctly.</p>
      <p>Time: {new Date().toISOString()}</p>
      <a href="/api/data?page=1&limit=5" className="text-blue-500 underline">
        Test API Data Endpoint
      </a>
    </div>
  );
}