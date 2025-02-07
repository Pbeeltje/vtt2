import { NextResponse } from 'next/server';

const IMGUR_CLIENT_ID = 'e2d5a22e7e01eb3';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const body = new FormData();
  body.append('image', file);

  try {
    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
      },
      body,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Imgur API error: ${errorData.data.error || response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({ url: data.data.link });
  } catch (error) {
    console.error('Error uploading to Imgur:', error);
    return NextResponse.json({ 
      error: 'Failed to upload image', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

