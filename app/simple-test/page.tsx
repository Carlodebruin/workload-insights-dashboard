'use client';

import React, { useState, useEffect } from 'react';

export default function SimpleTestPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('SimpleTest: Starting fetch');
    
    fetch('/api/data?page=1&limit=50')
      .then(response => {
        console.log('SimpleTest: Response status:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('SimpleTest: Data received:', {
          activitiesCount: data.activities?.length,
          activities: data.activities?.slice(0, 3)
        });
        
        setActivities(data.activities || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('SimpleTest: Error:', err);
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
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Simple Activities Test</h1>
      <p className="mb-4">Found {activities.length} activities</p>
      
      <div className="space-y-2">
        {activities.length > 0 ? (
          activities.slice(0, 10).map((activity: any, index: number) => (
            <div key={activity.id || index} className="p-3 border rounded">
              <strong>{activity.subcategory || 'Unknown'}</strong> - {activity.status || 'No Status'}
              <br />
              <small>{activity.location || 'No Location'}</small>
            </div>
          ))
        ) : (
          <div>No activities found</div>
        )}
      </div>

      <details className="mt-8">
        <summary>Raw JSON Data</summary>
        <pre className="mt-2 p-2 bg-gray-100 text-xs overflow-auto">
          {JSON.stringify(activities.slice(0, 5), null, 2)}
        </pre>
      </details>
    </div>
  );
}