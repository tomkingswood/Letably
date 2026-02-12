'use client';

import Link from 'next/link';
import { useSettings } from '@/hooks/useSettings';
import { useEffect } from 'react';

export default function TermsAndConditionsPage() {
  useEffect(() => {
    document.title = 'Terms & Conditions | Letably';
  }, []);
  const { siteSettings } = useSettings();

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">Terms & Conditions</h1>

      <div className="prose prose-lg max-w-none">
        <p className="text-gray-600 mb-6">
          Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">1. Introduction</h2>
          <p className="text-gray-700 mb-4">
            These terms and conditions govern your use of this website and the services we provide.
            By using our website or services, you accept these terms and conditions in full. If you disagree with
            any part of these terms and conditions, you must not use our website.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">2. About Us</h2>
          <p className="text-gray-700 mb-4">
            We are a letting agency specialising in providing quality accommodation and managing properties on behalf of landlords.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">3. Use of Website</h2>
          <p className="text-gray-700 mb-4">
            You may use our website for the following purposes:
          </p>
          <ul className="list-disc pl-6 mb-4 text-gray-700">
            <li>Browsing available properties</li>
            <li>Requesting property viewings</li>
            <li>Contacting us regarding our services</li>
            <li>Creating an account to manage your property search</li>
          </ul>
          <p className="text-gray-700 mb-4">
            You must not use our website in any way that causes, or may cause, damage to the website or
            impairment of the availability or accessibility of the website.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">4. Viewing Requests</h2>
          <p className="text-gray-700 mb-4">
            When you request a viewing through our website:
          </p>
          <ul className="list-disc pl-6 mb-4 text-gray-700">
            <li>We will contact you to arrange a suitable time for the viewing</li>
            <li>Viewings are subject to availability and property owner consent</li>
            <li>We reserve the right to refuse viewing requests at our discretion</li>
            <li>You must provide accurate contact information</li>
            <li>Multiple no-shows may result in restrictions on future viewing requests</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">5. Property Information</h2>
          <p className="text-gray-700 mb-4">
            While we make every effort to ensure property information on our website is accurate and up-to-date:
          </p>
          <ul className="list-disc pl-6 mb-4 text-gray-700">
            <li>Property details, prices, and availability are subject to change without notice</li>
            <li>Photographs are for illustrative purposes and may not reflect the current state of the property</li>
            <li>Room dimensions and property descriptions are approximate</li>
            <li>All properties are subject to availability at the time of enquiry</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">6. User Accounts</h2>
          <p className="text-gray-700 mb-4">
            If you create an account on our website:
          </p>
          <ul className="list-disc pl-6 mb-4 text-gray-700">
            <li>You must provide accurate and complete information</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials</li>
            <li>You must notify us immediately of any unauthorised use of your account</li>
            <li>You are responsible for all activities that occur under your account</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">7. Intellectual Property</h2>
          <p className="text-gray-700 mb-4">
            All content on this website, including but not limited to text, images, logos, and graphics,
            is the property of the letting agent or its content suppliers and is protected by UK and
            international copyright laws.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">8. Limitation of Liability</h2>
          <p className="text-gray-700 mb-4">
            The letting agent will not be liable for any loss or damage arising from:
          </p>
          <ul className="list-disc pl-6 mb-4 text-gray-700">
            <li>Your use of or inability to use our website</li>
            <li>Any inaccuracies or omissions in property information</li>
            <li>Delays or failures in the provision of our services</li>
            <li>Any action or decision taken in reliance on information provided on our website</li>
          </ul>
          <p className="text-gray-700 mb-4">
            Nothing in these terms and conditions excludes or limits our liability for death or personal
            injury caused by our negligence, fraud, or any other liability that cannot be excluded by law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">9. Data Protection</h2>
          <p className="text-gray-700 mb-4">
            We process personal data in accordance with our Privacy Policy and applicable data protection
            legislation, including the UK GDPR. By using our website, you consent to such processing.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">10. Changes to Terms</h2>
          <p className="text-gray-700 mb-4">
            We reserve the right to update these terms and conditions at any time. Changes will be effective
            immediately upon posting to the website. Your continued use of the website following any changes
            constitutes acceptance of those changes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">11. Governing Law</h2>
          <p className="text-gray-700 mb-4">
            These terms and conditions are governed by and construed in accordance with English law.
            Any disputes relating to these terms and conditions will be subject to the exclusive jurisdiction
            of the courts of England and Wales.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">12. Contact Information</h2>
          <p className="text-gray-700 mb-4">
            If you have any questions about these Terms & Conditions, please contact us:
          </p>
          <ul className="list-none mb-4 text-gray-700">
            <li><strong>Email:</strong> {siteSettings.email_address}</li>
            <li><strong>Phone:</strong> {siteSettings.phone_number}</li>
          </ul>
        </section>

        <div className="mt-8 pt-8 border-t border-gray-300">
          <Link href="/" className="text-primary hover:text-primary-dark">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
