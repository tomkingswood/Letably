'use client';

import Link from 'next/link';
import { useSettings } from '@/hooks/useSettings';
import { useEffect } from 'react';

export default function CookiePolicyPage() {
  useEffect(() => {
    document.title = 'Cookie Policy | Letably';
  }, []);
  const { siteSettings } = useSettings();

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">Cookie Policy</h1>

      <div className="prose prose-lg max-w-none">
        <p className="text-gray-600 mb-6">
          Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">What Are Cookies</h2>
          <p className="text-gray-700 mb-4">
            Cookies are small text files that are placed on your computer or mobile device when you visit a website.
            They are widely used to make websites work more efficiently and provide information to website owners.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">How We Use Cookies</h2>
          <p className="text-gray-700 mb-4">
            We use cookies to improve your experience on our website. We use cookies to:
          </p>
          <ul className="list-disc pl-6 mb-4 text-gray-700">
            <li>Remember your preferences and settings</li>
            <li>Keep you signed in to your account</li>
            <li>Understand how you use our website to improve our services</li>
            <li>Ensure the security of our website</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Types of Cookies We Use</h2>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2 text-gray-900">Essential Cookies</h3>
            <p className="text-gray-700">
              These cookies are necessary for the website to function properly. They enable basic functions like
              page navigation, access to secure areas, and authentication. The website cannot function properly
              without these cookies.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2 text-gray-900">Functionality Cookies</h3>
            <p className="text-gray-700">
              These cookies allow us to remember choices you make (such as your preferred language or region)
              and provide enhanced, more personalized features.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2 text-gray-900">Performance Cookies</h3>
            <p className="text-gray-700">
              These cookies help us understand how visitors interact with our website by collecting and reporting
              information anonymously. This helps us improve how our website works.
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Third-Party Cookies</h2>
          <p className="text-gray-700 mb-4">
            We may use third-party services that set cookies on your device. These include:
          </p>
          <ul className="list-disc pl-6 mb-4 text-gray-700">
            <li>Analytics services to help us understand website usage</li>
            <li>Social media platforms for social sharing features</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Managing Cookies</h2>
          <p className="text-gray-700 mb-4">
            You can control and manage cookies in various ways. Please note that removing or blocking cookies
            may impact your user experience and some functionality may not work as intended.
          </p>
          <p className="text-gray-700 mb-4">
            Most browsers allow you to:
          </p>
          <ul className="list-disc pl-6 mb-4 text-gray-700">
            <li>View what cookies are stored and delete them individually</li>
            <li>Block third-party cookies</li>
            <li>Block cookies from specific sites</li>
            <li>Block all cookies</li>
            <li>Delete all cookies when you close your browser</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Contact Us</h2>
          <p className="text-gray-700 mb-4">
            If you have any questions about our Cookie Policy, please contact us:
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
