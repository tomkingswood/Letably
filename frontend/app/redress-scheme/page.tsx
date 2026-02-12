'use client';

import Link from 'next/link';
import { useSettings } from '@/hooks/useSettings';
import { useEffect } from 'react';

export default function RedressPage() {
  useEffect(() => {
    document.title = 'Redress Scheme | Letably';
  }, []);
  const { siteSettings } = useSettings();

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">Redress Scheme</h1>

      <div className="prose prose-lg max-w-none">
        <p className="text-gray-600 mb-6">
          Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Legal Requirement</h2>
          <p className="text-gray-700 mb-4">
            Under The Redress Schemes for Lettings Agency Work and Property Management Work (Requirement to Belong
            to a Scheme etc.) (England) Order 2014, all letting and property management agents in England are legally
            required to join a government-approved redress scheme.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Our Redress Scheme Membership</h2>

          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-l-4 border-primary p-6 rounded-lg mb-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-gray-700 mb-3">
                  <strong className="text-gray-900">Company Name:</strong><br />
                  {siteSettings.company_name}
                </p>
                <p className="text-gray-700 mb-3">
                  <strong className="text-gray-900">Scheme Name:</strong><br />
                  {siteSettings.redress_scheme_name}
                </p>
                <p className="text-gray-700 mb-3">
                  <strong className="text-gray-900">Membership Number:</strong><br />
                  {siteSettings.redress_scheme_number}
                </p>
                {siteSettings.redress_scheme_url && (
                  <p className="text-gray-700">
                    <strong className="text-gray-900">Scheme Website:</strong><br />
                    <a
                      href={siteSettings.redress_scheme_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {siteSettings.redress_scheme_url}
                    </a>
                  </p>
                )}
              </div>

              {siteSettings.prs_certificate_filename && (
                <div className="flex items-center justify-center">
                  <a
                    href={`/${siteSettings.prs_certificate_filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={`/${siteSettings.prs_certificate_filename}`}
                      alt={`${siteSettings.redress_scheme_name} Certificate`}
                      className="max-w-full h-auto rounded-lg shadow-md border border-gray-200"
                      style={{ maxHeight: '300px' }}
                    />
                    <p className="text-center text-sm text-gray-600 mt-2">Click to view certificate</p>
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">What is a Redress Scheme?</h2>
          <p className="text-gray-700 mb-4">
            A redress scheme provides an independent dispute resolution service for complaints about letting
            agents and property managers. If you have a complaint that we have been unable to resolve through
            our internal complaints procedure, you can refer your complaint to our redress scheme for independent
            review.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">When Can You Use the Redress Scheme?</h2>
          <p className="text-gray-700 mb-4">
            You can refer a complaint to the redress scheme when:
          </p>
          <ul className="list-disc pl-6 mb-4 text-gray-700">
            <li>You have completed our internal complaints procedure</li>
            <li>You are not satisfied with our final response</li>
            <li>The complaint relates to our letting or property management services</li>
            <li>The complaint is made within the scheme's time limits (typically within 12 months of the issue occurring)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">How to Make a Complaint to the Redress Scheme</h2>
          <p className="text-gray-700 mb-4">
            To make a complaint to our redress scheme:
          </p>
          <ol className="list-decimal pl-6 mb-4 text-gray-700 space-y-2">
            <li>Ensure you have completed our internal complaints procedure first</li>
            <li>Visit the redress scheme's website (details above)</li>
            <li>Complete their online complaint form or download a paper form</li>
            <li>Provide evidence of your complaint and our final response</li>
            <li>Submit your complaint to the scheme</li>
          </ol>
          <p className="text-gray-700 mb-4">
            The redress scheme will review your complaint independently and may require both parties to provide
            additional information. Their decision is binding on us but not on you (you retain your legal rights).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Important Information</h2>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Using a redress scheme is free of charge</li>
              <li>You must first complete our complaints procedure before approaching the redress scheme</li>
              <li>The redress scheme will not investigate complaints that are subject to legal proceedings</li>
              <li>There are time limits for making complaints - check with the scheme for details</li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Alternative Options</h2>
          <p className="text-gray-700 mb-4">
            In addition to the redress scheme, you may also consider:
          </p>
          <ul className="list-disc pl-6 mb-4 text-gray-700">
            <li>
              <strong>Local Authority:</strong> Sheffield City Council Trading Standards can investigate breaches
              of consumer protection legislation
            </li>
            <li>
              <strong>Citizens Advice:</strong> Provides free, independent advice on your rights
            </li>
            <li>
              <strong>Legal Action:</strong> You retain your right to take legal action through the courts
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Contact Us First</h2>
          <p className="text-gray-700 mb-4">
            Before escalating to the redress scheme, please give us the opportunity to resolve your complaint.
            Visit our <Link href="/complaints" className="text-primary hover:underline">Complaints Procedure</Link> page
            or contact us:
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
