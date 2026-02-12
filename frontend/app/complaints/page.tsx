'use client';

import Link from 'next/link';
import { useSettings } from '@/hooks/useSettings';

export default function ComplaintsPage() {
  const { siteSettings } = useSettings();

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">Complaints Procedure</h1>

      <div className="prose prose-lg max-w-none">
        <p className="text-gray-600 mb-6">
          Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Our Commitment</h2>
          <p className="text-gray-700 mb-4">
            We are committed to providing excellent service to all our tenants and landlords.
            However, we recognise that there may be occasions when you feel our service has not met your expectations.
            We take all complaints seriously and aim to resolve them quickly and fairly.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">How to Make a Complaint</h2>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2 text-gray-900">Step 1: Contact Us Directly</h3>
            <p className="text-gray-700 mb-4">
              In the first instance, please contact us directly to discuss your complaint. Many issues can be
              resolved quickly through direct communication.
            </p>
            <ul className="list-none mb-4 text-gray-700 bg-gray-50 p-4 rounded-lg">
              <li className="mb-2"><strong>Email:</strong> {siteSettings.email_address}</li>
              <li className="mb-2"><strong>Phone:</strong> {siteSettings.phone_number}</li>
              <li><strong>Office Hours:</strong> Monday - Friday, 9:00 AM - 5:00 PM</li>
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2 text-gray-900">Step 2: Formal Written Complaint</h3>
            <p className="text-gray-700 mb-4">
              If your complaint is not resolved to your satisfaction, please submit a formal written complaint via email.
              Your complaint should include:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Your full name and contact details</li>
              <li>Your property address (if applicable)</li>
              <li>A clear description of the issue</li>
              <li>Details of any previous communication about the issue</li>
              <li>What outcome you would like to achieve</li>
              <li>Any supporting evidence (photos, documents, etc.)</li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Our Response Process</h2>

          <div className="space-y-4">
            <div className="bg-primary/10 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Within 3 Working Days</h4>
              <p className="text-gray-700">
                We will acknowledge receipt of your complaint and provide you with a reference number.
              </p>
            </div>

            <div className="bg-primary/10 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Within 15 Working Days</h4>
              <p className="text-gray-700">
                We will provide you with a full written response, explaining our findings and any actions we will take.
              </p>
            </div>

            <div className="bg-primary/10 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Complex Cases</h4>
              <p className="text-gray-700">
                If your complaint requires detailed investigation, we will keep you informed of progress and provide
                regular updates until the matter is resolved.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Independent Redress</h2>
          <p className="text-gray-700 mb-4">
            We are a member of a government-approved redress scheme. If you are not satisfied with
            our final response to your complaint, you have the right to refer your complaint to our redress scheme
            for independent review.
          </p>
          <p className="text-gray-700 mb-4">
            For more information about our redress scheme membership, please visit our{' '}
            <Link href="/redress-scheme" className="text-primary hover:underline">
              Redress Scheme page
            </Link>.
          </p>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <p className="text-gray-700">
              <strong>Important:</strong> You must first complete our internal complaints procedure before
              referring your complaint to the redress scheme.
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">What We Expect From You</h2>
          <p className="text-gray-700 mb-4">
            To help us resolve your complaint effectively, we ask that you:
          </p>
          <ul className="list-disc pl-6 mb-4 text-gray-700">
            <li>Provide clear and accurate information</li>
            <li>Respond promptly to our requests for information</li>
            <li>Treat our staff with respect and courtesy</li>
            <li>Be realistic about outcomes and timescales</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Learning From Complaints</h2>
          <p className="text-gray-700 mb-4">
            We view complaints as an opportunity to improve our services. All complaints are reviewed by our
            management team, and we use this feedback to identify areas where we can enhance our service delivery.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Contact Information</h2>
          <p className="text-gray-700 mb-4">
            To make a complaint or for more information about our complaints procedure:
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
