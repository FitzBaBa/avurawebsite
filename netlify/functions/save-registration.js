import { neon } from '@neondatabase/serverless';

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();
    const sql = neon(process.env.NEON_DATABASE_URL); // Uses env var

    const { full_name, email, phone, dob, gender, coverage_level, dependents, dependents_names, total_amount, payment_status, payment_reference, payment_date, occupation, emergency_name, emergency_phone, street, city, state } = body;

    await sql`
      INSERT INTO registrations (
        full_name, email, phone, dob, gender, coverage_level, dependents, dependents_names, total_amount, payment_status, payment_reference, payment_date, occupation, emergency_name, emergency_phone, street, city, state
      ) VALUES (
        ${full_name}, ${email}, ${phone}, ${dob}, ${gender}, ${coverage_level}, ${dependents}, ${dependents_names}, ${total_amount}, ${payment_status}, ${payment_reference}, ${payment_date}, ${occupation}, ${emergency_name}, ${emergency_phone}, ${street}, ${city}, ${state}
      )
    `;

    return new Response(JSON.stringify({ result: 'success', message: 'Data saved successfully!' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error saving data:', error);
    return new Response(JSON.stringify({ result: 'error', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};