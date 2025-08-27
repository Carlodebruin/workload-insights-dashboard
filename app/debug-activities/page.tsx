'use client';

import React, { useState, useEffect } from 'react';
import { fetchInitialData } from '../../lib/api';

export default function DebugActivitiesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[DebugPage] Fetching data...');
    fetchInitialData()
      .then((result) => {
        console.log('[DebugPage] Data received:', result);
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[DebugPage] Error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug: Activities Data</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-100 p-4 rounded">
          <h2 className="font-semibold">Users</h2>
          <p className="text-2xl">{data?.users?.length || 0}</p>
        </div>
        <div className="bg-green-100 p-4 rounded">
          <h2 className="font-semibold">Categories</h2>
          <p className="text-2xl">{data?.categories?.length || 0}</p>
        </div>
        <div className="bg-yellow-100 p-4 rounded">
          <h2 className="font-semibold">Activities</h2>
          <p className="text-2xl">{data?.activities?.length || 0}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Activities</h2>
        {data?.activities?.length > 0 ? (
          data.activities.slice(0, 10).map((activity: any, index: number) => (
            <div key={activity.id} className="border p-4 rounded bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium">{activity.subcategory}</h3>
                <span className={`px-2 py-1 rounded text-xs ${
                  activity.status === 'Open' ? 'bg-green-100 text-green-800' :
                  activity.status === 'Unassigned' ? 'bg-yellow-100 text-yellow-800' :
                  activity.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                  activity.status === 'Resolved' ? 'bg-gray-100 text-gray-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {activity.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-1">📍 {activity.location}</p>
              <p className="text-sm text-gray-600 mb-1">👤 User ID: {activity.user_id}</p>
              <p className="text-sm text-gray-600 mb-1">🏷️ Category ID: {activity.category_id}</p>
              <p className="text-xs text-gray-500">Created: {new Date(activity.timestamp).toLocaleString()}</p>
              {activity.notes && (
                <p className="text-sm mt-2 p-2 bg-white rounded border">
                  📝 {activity.notes}
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="text-gray-500">No activities found</p>
        )}
      </div>

      <div className="mt-8 bg-gray-100 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Raw Data (JSON)</h2>
        <pre className="text-xs overflow-auto max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}