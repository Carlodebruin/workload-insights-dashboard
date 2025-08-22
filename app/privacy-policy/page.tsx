import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Workload Insights Dashboard',
  description: 'Privacy Policy for Workload Insights Dashboard WhatsApp Business integration',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        
        <div className="prose prose-lg max-w-none text-gray-700">
          <p className="text-sm text-gray-500 mb-6">
            <strong>Last Updated:</strong> August 22, 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="mb-4">
              Workload Insights Dashboard ("we", "our", or "us") operates a school maintenance and incident management system 
              that integrates with WhatsApp Business API. This Privacy Policy explains how we collect, use, disclose, and 
              safeguard your information when you interact with our WhatsApp Business service.
            </p>
            <p>
              This policy complies with the Protection of Personal Information Act (POPIA) of South Africa and WhatsApp's 
              Business Policy requirements.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
            <h3 className="text-lg font-medium text-gray-800 mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>WhatsApp phone number</li>
              <li>Messages you send to our WhatsApp Business account</li>
              <li>Incident reports and maintenance requests</li>
              <li>Location information related to reported incidents</li>
              <li>Photos or media files you share for incident documentation</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">2.2 Information Automatically Collected</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Message timestamps</li>
              <li>Message delivery status</li>
              <li>WhatsApp user profile information (if publicly available)</li>
              <li>Technical metadata required for service operation</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <p className="mb-4">We use the collected information for the following purposes:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Service Delivery:</strong> Processing incident reports and maintenance requests</li>
              <li><strong>Communication:</strong> Sending confirmations, updates, and status notifications</li>
              <li><strong>AI Processing:</strong> Using artificial intelligence to categorize and prioritize incidents</li>
              <li><strong>Record Keeping:</strong> Maintaining accurate records for facility management</li>
              <li><strong>Service Improvement:</strong> Analyzing patterns to improve response times and service quality</li>
              <li><strong>Compliance:</strong> Meeting legal and regulatory requirements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Legal Basis for Processing (POPIA Compliance)</h2>
            <p className="mb-4">Under POPIA, we process your personal information based on:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Consent:</strong> You provide explicit consent by messaging our WhatsApp Business account</li>
              <li><strong>Legitimate Interest:</strong> Maintaining safe and functional school facilities</li>
              <li><strong>Legal Obligation:</strong> Compliance with health and safety regulations</li>
              <li><strong>Performance of Contract:</strong> Fulfilling our service obligations to the educational institution</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Sharing and Disclosure</h2>
            <p className="mb-4">We may share your information with:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>School Staff:</strong> Relevant personnel for incident resolution</li>
              <li><strong>Maintenance Teams:</strong> Service providers assigned to address reported issues</li>
              <li><strong>WhatsApp/Meta:</strong> As required for WhatsApp Business API functionality</li>
              <li><strong>AI Service Providers:</strong> For message processing and categorization (Claude AI)</li>
              <li><strong>Legal Authorities:</strong> When required by law or to protect safety</li>
            </ul>
            <p>
              We do not sell, rent, or trade your personal information to third parties for marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Security</h2>
            <p className="mb-4">We implement appropriate technical and organizational measures to protect your information:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Encrypted data transmission and storage</li>
              <li>Access controls and authentication</li>
              <li>Regular security assessments and updates</li>
              <li>Staff training on data protection</li>
              <li>Secure cloud infrastructure (Vercel, Neon Database)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Data Retention</h2>
            <p className="mb-4">
              We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Active Incidents:</strong> Until resolution and closure</li>
              <li><strong>Historical Records:</strong> Up to 7 years for compliance and audit purposes</li>
              <li><strong>WhatsApp Messages:</strong> Stored according to operational needs, typically 2-3 years</li>
              <li><strong>Inactive Accounts:</strong> Deleted after 12 months of inactivity</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Your Rights Under POPIA</h2>
            <p className="mb-4">You have the following rights regarding your personal information:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Access:</strong> Request access to your personal information</li>
              <li><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Objection:</strong> Object to processing of your personal information</li>
              <li><strong>Restriction:</strong> Request restriction of processing</li>
              <li><strong>Portability:</strong> Request transfer of your data to another service</li>
              <li><strong>Withdraw Consent:</strong> Withdraw consent at any time</li>
            </ul>
            <p>
              To exercise these rights, contact us using the information provided in Section 11.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. WhatsApp-Specific Considerations</h2>
            <p className="mb-4">When using our WhatsApp Business service:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Messages are subject to WhatsApp's Terms of Service and Privacy Policy</li>
              <li>We use WhatsApp Business API in compliance with Meta's business policies</li>
              <li>Your WhatsApp profile information may be visible to our business account</li>
              <li>Message encryption is handled by WhatsApp's infrastructure</li>
              <li>You can block or report our business account through WhatsApp if needed</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Children's Privacy</h2>
            <p>
              Our service is designed for use by school staff and authorized personnel. We do not knowingly collect 
              personal information from children under 13. If we become aware that we have collected personal information 
              from a child under 13, we will take steps to delete such information promptly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contact Information</h2>
            <p className="mb-4">
              For questions about this Privacy Policy or to exercise your rights, contact us:
            </p>
            <div className="bg-gray-100 p-4 rounded-lg">
              <p><strong>Email:</strong> privacy@workloadinsights.com</p>
              <p><strong>Address:</strong> [Your Business Address]</p>
              <p><strong>Phone:</strong> [Your Contact Number]</p>
              <p><strong>Data Protection Officer:</strong> [DPO Contact if applicable]</p>
            </div>
            <p className="mt-4">
              <strong>Information Regulator (South Africa):</strong><br />
              If you are not satisfied with our response to your privacy concerns, you may lodge a complaint with the 
              Information Regulator at <a href="https://www.justice.gov.za/inforegulator/" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">https://www.justice.gov.za/inforegulator/</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting 
              the new Privacy Policy on this page and updating the "Last Updated" date. Continued use of our WhatsApp 
              service after such changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Governing Law</h2>
            <p>
              This Privacy Policy is governed by the laws of South Africa, including the Protection of Personal Information 
              Act (POPIA). Any disputes arising from this policy will be subject to the jurisdiction of South African courts.
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              This privacy policy has been designed to comply with WhatsApp Business Policy requirements and South African 
              data protection laws (POPIA). For technical support regarding our incident management system, please use our 
              WhatsApp Business account or contact your system administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}