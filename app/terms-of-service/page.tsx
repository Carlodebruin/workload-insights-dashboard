import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - Workload Insights Dashboard',
  description: 'Terms of Service for Workload Insights Dashboard WhatsApp Business integration and incident management system',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        
        <div className="prose prose-lg max-w-none text-gray-700">
          <p className="text-sm text-gray-500 mb-6">
            <strong>Last Updated:</strong> August 22, 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction and Acceptance</h2>
            <p className="mb-4">
              Welcome to Workload Insights Dashboard ("Service", "we", "our", or "us"), an incident management and 
              maintenance reporting system designed for educational institutions. These Terms of Service ("Terms") 
              govern your use of our WhatsApp Business integration and web-based platform.
            </p>
            <p className="mb-4">
              By accessing or using our Service, including sending messages to our WhatsApp Business account, you 
              agree to be bound by these Terms. If you do not agree to these Terms, please do not use our Service.
            </p>
            <p>
              These Terms comply with South African law, educational sector best practices, and WhatsApp Business 
              Policy requirements.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Service Description</h2>
            <p className="mb-4">Our Service provides:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Incident Reporting:</strong> WhatsApp-based system for reporting maintenance issues, safety concerns, and facility problems</li>
              <li><strong>AI-Powered Processing:</strong> Automated categorization and prioritization of incident reports</li>
              <li><strong>Task Management:</strong> Assignment and tracking of maintenance and repair tasks</li>
              <li><strong>Communication Platform:</strong> Bi-directional messaging for status updates and coordination</li>
              <li><strong>Dashboard Analytics:</strong> Web-based insights and reporting for facility management</li>
              <li><strong>Documentation System:</strong> Record keeping for compliance and audit purposes</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Authorized Users and Access</h2>
            <h3 className="text-lg font-medium text-gray-800 mb-3">3.1 Eligible Users</h3>
            <p className="mb-4">This Service is restricted to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Authorized school staff members</li>
              <li>Contracted maintenance personnel</li>
              <li>School administrators and management</li>
              <li>Approved service providers</li>
              <li>Other personnel designated by the educational institution</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">3.2 Account Responsibilities</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Users must provide accurate contact information</li>
              <li>WhatsApp numbers must be associated with authorized personnel</li>
              <li>Users are responsible for maintaining confidentiality of their access</li>
              <li>Unauthorized sharing of access credentials is prohibited</li>
              <li>Users must notify administration of personnel changes affecting access</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Acceptable Use Policy</h2>
            <h3 className="text-lg font-medium text-gray-800 mb-3">4.1 Permitted Uses</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Reporting legitimate maintenance issues and safety concerns</li>
              <li>Providing updates on assigned tasks and work progress</li>
              <li>Requesting status information on submitted reports</li>
              <li>Coordinating with maintenance teams and administrators</li>
              <li>Documenting facility conditions with appropriate photos</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">4.2 Prohibited Activities</h3>
            <p className="mb-4">Users must NOT:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Submit false, misleading, or fraudulent reports</li>
              <li>Use the Service for personal, non-work-related communications</li>
              <li>Share inappropriate content, including offensive language or images</li>
              <li>Attempt to access unauthorized areas of the system</li>
              <li>Interfere with the Service's operation or security</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Harass, threaten, or abuse other users</li>
              <li>Share confidential information inappropriately</li>
              <li>Use the Service for commercial solicitation</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Educational Institution Responsibilities</h2>
            <h3 className="text-lg font-medium text-gray-800 mb-3">5.1 Child Protection and Safety</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Priority handling of reports affecting student safety</li>
              <li>Immediate escalation protocols for emergency situations</li>
              <li>Compliance with child protection policies and procedures</li>
              <li>Regular safety audits and preventive maintenance scheduling</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">5.2 Compliance and Governance</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Adherence to Department of Education facility standards</li>
              <li>Compliance with occupational health and safety regulations</li>
              <li>Maintenance of proper insurance and liability coverage</li>
              <li>Regular review and update of emergency procedures</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Handling and Privacy</h2>
            <p className="mb-4">
              Our data handling practices are governed by our separate 
              <a href="/privacy-policy" className="text-blue-600 hover:underline"> Privacy Policy</a>, 
              which forms an integral part of these Terms. Key principles include:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Protection of Personal Information Act (POPIA) compliance</li>
              <li>Secure storage and transmission of all communications</li>
              <li>Limited access to authorized personnel only</li>
              <li>Regular data backup and disaster recovery procedures</li>
              <li>Transparent data processing and retention policies</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Service Availability and Reliability</h2>
            <h3 className="text-lg font-medium text-gray-800 mb-3">7.1 Service Commitment</h3>
            <p className="mb-4">We strive to provide:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>24/7 availability for emergency incident reporting</li>
              <li>Prompt AI-powered categorization and routing</li>
              <li>Automated confirmation messages for all submissions</li>
              <li>Regular system monitoring and maintenance</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">7.2 Service Limitations</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Service depends on WhatsApp availability and internet connectivity</li>
              <li>AI processing may occasionally require manual review</li>
              <li>Response times may vary based on issue severity and resources</li>
              <li>Planned maintenance windows will be communicated in advance</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Emergency Procedures</h2>
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Emergency Situations</h3>
                  <p className="mt-1 text-sm text-red-700">
                    For immediate life-threatening emergencies, call 10111 (Police), 10177 (Ambulance), or 021 480 7700 (Fire Department) 
                    FIRST, then report through our system for coordination.
                  </p>
                </div>
              </div>
            </div>
            
            <h3 className="text-lg font-medium text-gray-800 mb-3">8.1 Priority Classification</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Emergency (Response: Immediate):</strong> Life-threatening situations, fire hazards, electrical dangers</li>
              <li><strong>Urgent (Response: 1-2 hours):</strong> Safety risks, security breaches, essential system failures</li>
              <li><strong>High Priority (Response: Same day):</strong> Significant disruptions to learning environment</li>
              <li><strong>Standard (Response: 24-48 hours):</strong> Routine maintenance and minor repairs</li>
              <li><strong>Low Priority (Response: 2-5 days):</strong> Cosmetic issues and non-urgent improvements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Intellectual Property Rights</h2>
            <h3 className="text-lg font-medium text-gray-800 mb-3">9.1 Service Ownership</h3>
            <p className="mb-4">
              The Workload Insights Dashboard platform, including its software, design, content, and AI processing 
              capabilities, is owned by us and protected by intellectual property laws.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">9.2 User Content</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>You retain ownership of content you submit (reports, photos, descriptions)</li>
              <li>You grant us a license to use your content for service delivery purposes</li>
              <li>All incident reports become part of the institutional maintenance record</li>
              <li>Anonymized data may be used for system improvement and analytics</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Liability and Disclaimers</h2>
            <h3 className="text-lg font-medium text-gray-800 mb-3">10.1 Service Limitations</h3>
            <p className="mb-4">Our Service is provided "as is" and we:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Do not guarantee uninterrupted service availability</li>
              <li>Are not responsible for WhatsApp or internet connectivity issues</li>
              <li>Cannot guarantee specific response times for non-emergency issues</li>
              <li>Are not liable for consequences of delayed incident reporting</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">10.2 Educational Institution Liability</h3>
            <p className="mb-4">
              The educational institution remains responsible for:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Ensuring adequate response resources and personnel</li>
              <li>Maintaining proper insurance coverage</li>
              <li>Complying with health and safety regulations</li>
              <li>Providing appropriate training to staff and contractors</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Suspension and Termination</h2>
            <h3 className="text-lg font-medium text-gray-800 mb-3">11.1 Grounds for Suspension</h3>
            <p className="mb-4">We may suspend or terminate access for:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Violation of these Terms of Service</li>
              <li>Misuse of the Service or inappropriate behavior</li>
              <li>Unauthorized access attempts or security breaches</li>
              <li>Employment termination or role changes</li>
              <li>Request from the educational institution</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">11.2 Appeal Process</h3>
            <p className="mb-4">
              Users may appeal suspension decisions by contacting the system administrator or designated school official. 
              Appeals will be reviewed in accordance with the institution's grievance procedures.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Compliance and Legal Framework</h2>
            <h3 className="text-lg font-medium text-gray-800 mb-3">12.1 Applicable Laws</h3>
            <p className="mb-4">This Service operates under:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>South African Schools Act and education regulations</li>
              <li>Occupational Health and Safety Act requirements</li>
              <li>Protection of Personal Information Act (POPIA)</li>
              <li>Consumer Protection Act provisions</li>
              <li>Electronic Communications and Transactions Act</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">12.2 Reporting Obligations</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Certain incidents may require reporting to authorities</li>
              <li>Safety incidents involving students receive priority handling</li>
              <li>Environmental hazards are escalated to appropriate agencies</li>
              <li>All communications are subject to institutional policies</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Training and Support</h2>
            <h3 className="text-lg font-medium text-gray-800 mb-3">13.1 User Training</h3>
            <p className="mb-4">The educational institution should provide:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Initial training on proper use of the incident reporting system</li>
              <li>Regular updates on system features and procedures</li>
              <li>Clear guidelines for emergency vs. non-emergency situations</li>
              <li>Documentation of reporting protocols and expectations</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">13.2 Technical Support</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>System status updates and maintenance notifications</li>
              <li>Help documentation and user guides</li>
              <li>Technical assistance for system-related issues</li>
              <li>Regular system updates and feature enhancements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Changes to Terms</h2>
            <p className="mb-4">
              We reserve the right to modify these Terms at any time. Changes will be:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Posted on this page with an updated "Last Updated" date</li>
              <li>Communicated to users through appropriate channels</li>
              <li>Effective immediately upon posting unless otherwise specified</li>
              <li>Subject to review and input from the educational institution</li>
            </ul>
            <p>
              Continued use of the Service after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Contact Information and Dispute Resolution</h2>
            <div className="bg-gray-100 p-4 rounded-lg mb-4">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Service Support</h3>
              <p><strong>Technical Issues:</strong> Use our WhatsApp Business account or contact your system administrator</p>
              <p><strong>Policy Questions:</strong> terms@workloadinsights.com</p>
              <p><strong>Emergency Support:</strong> [Institution Emergency Contact]</p>
              <p><strong>Business Address:</strong> [Your Business Address]</p>
            </div>

            <h3 className="text-lg font-medium text-gray-800 mb-3">15.1 Dispute Resolution</h3>
            <p className="mb-4">In case of disputes:</p>
            <ol className="list-decimal pl-6 mb-4 space-y-2">
              <li>First contact the system administrator or designated school official</li>
              <li>If unresolved, follow the institution's formal grievance procedures</li>
              <li>Legal disputes will be governed by South African law and subject to local jurisdiction</li>
              <li>Mediation may be pursued before formal legal proceedings</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">16. Acknowledgment and Agreement</h2>
            <p className="mb-4">
              By using our WhatsApp Business incident reporting service, you acknowledge that you have:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Read and understood these Terms of Service</li>
              <li>Reviewed our Privacy Policy</li>
              <li>Been authorized by your educational institution to use this Service</li>
              <li>Received appropriate training on incident reporting procedures</li>
              <li>Agreed to comply with all applicable policies and regulations</li>
            </ul>
          </section>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              These Terms of Service are designed to ensure safe, effective, and compliant use of our incident management 
              system within educational environments. For questions about specific institutional policies or procedures, 
              please consult your local school administration.
            </p>
            <p className="text-sm text-gray-500 mt-4">
              <strong>Related Documents:</strong> 
              <a href="/privacy-policy" className="text-blue-600 hover:underline ml-1">Privacy Policy</a> |
              <span className="mx-1">User Manual</span> |
              <span className="mx-1">Emergency Procedures Guide</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}