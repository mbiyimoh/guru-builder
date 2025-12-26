// Test Mental Model Generation API
const projectId = 'cmjdakqtt0002e95cs8t2lfz4';
const apiUrl = `http://localhost:3009/api/projects/${projectId}/guru/mental-model`;

async function testGeneration() {
  console.log('🚀 Testing Mental Model Generation...');
  console.log('Endpoint:', apiUrl);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userNotes: 'Test generation from script'
      })
    });

    console.log('\n📊 Response Status:', response.status, response.statusText);

    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      console.log('\n📦 Response Data:');
      console.log(JSON.stringify(data, null, 2));

      if (response.ok) {
        console.log('\n✅ Generation started successfully!');
        console.log('Artifact ID:', data.artifactId);
        console.log('Version:', data.version);
      } else {
        console.log('\n❌ Generation failed!');
        console.log('Error:', data.error);
      }
    } else {
      const text = await response.text();
      console.log('\n📄 Response Text:');
      console.log(text);
    }
  } catch (error) {
    console.error('\n💥 Request failed:', error.message);
  }
}

testGeneration();
