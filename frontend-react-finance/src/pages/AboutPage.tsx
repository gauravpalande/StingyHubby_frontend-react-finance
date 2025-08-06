import React from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useNavigate } from 'react-router-dom';

const AboutContent: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div style={{
    position: 'relative',
    padding: 24,
    maxWidth: 900,
    margin: '0 auto',
    fontFamily: 'Segoe UI, Arial, sans-serif',
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)'
  }}>
    {/* ✅ Close button */}
    <button
      onClick={onClose}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        border: 'none',
        background: 'transparent',
        fontSize: 20,
        cursor: 'pointer',
      }}
      aria-label="Close"
    >
      ✕
    </button>

    <h1 style={{ color: '#2d3748', marginBottom: 8 }}>About PennyWize</h1>
    <p style={{ color: '#4a5568', marginBottom: 32 }}>
      PennyWize helps you manage your personal finances by tracking income and expenses,
      offering GPT-powered advice, and visualizing your financial history.
    </p>

    {/* PennyWize Youtube Channel Section */}
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 22, marginBottom: 8 }}>PennyWize Youtube Channel</h2>
      <div style={{
      background: '#f7fafc',
      padding: 20,
      borderRadius: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
      }}>
      <a
        href="https://www.youtube.com/@PennyWize1"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#3182ce', fontWeight: 500, fontSize: 16 }}
      >
        www.youtube.com/@PennyWize1
      </a>
      </div>
    </section>
    
    {/* Developer Section */}
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 22, marginBottom: 8 }}>Developer</h2>
      <div style={{
        background: '#f7fafc',
        padding: 20,
        borderRadius: 8,
        boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
      }}>
        <h3 style={{ margin: 0, color: '#2d3748', fontSize: 20 }}>Gaurav Palande</h3>
        <div style={{ color: '#4a5568', margin: '8px 0' }}>
          Chino Hills, CA &nbsp;|&nbsp; (562) 331-9226 &nbsp;|&nbsp; gaurav.palande147@gmail.com
        </div>
        <div style={{ marginBottom: 8 }}>
          <a href="https://www.linkedin.com/in/gaurav-palande-50549550" target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce', marginRight: 16 }}>LinkedIn</a>
          <a href="https://github.com/gauravpalande" target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce', marginRight: 16 }}>GitHub</a>
          <a href="https://pennywize.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce' }}>Website</a>
        </div>
      </div>
    </section>

    {/* Summary, Certifications, Education */}
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 20, marginBottom: 8 }}>Professional Summary</h2>
      <p style={{ color: '#4a5568' }}>
        Experienced Software Engineer with 10+ years of expertise in building secure, high-performance enterprise applications using C#, .NET Core, SQL Server, and cloud-native solutions on AWS. Proven ability to reduce system downtime, improve database efficiency, and lead modernization efforts in Agile environments. Recognized with multiple awards for technical excellence and cross-team collaboration.
      </p>
    </section>

    <section style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 20, marginBottom: 8 }}>Certification</h2>
      <ul style={{ color: '#4a5568', margin: 0, paddingLeft: 20 }}>
        <li>AWS Certified Cloud Practitioner, Amazon Web Services (2024)</li>
      </ul>
    </section>

    <section style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 20, marginBottom: 8 }}>Education</h2>
      <div style={{ color: '#4a5568', marginBottom: 8 }}>
        <strong>Master of Science in Computer Science</strong><br />
        California State University, Long Beach, CA<br />
        GPA: 3.8 | Phi Kappa Phi Honors | Aug 2015 - May 2017
      </div>
      <div style={{ color: '#4a5568' }}>
        <strong>Bachelor of Engineering in Computer Engineering</strong><br />
        University of Mumbai, Mumbai, India<br />
        GPA: 3.6 | Jul 2008 - May 2012
      </div>
    </section>

    {/* Skills */}
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 20, marginBottom: 8 }}>Technical Skills</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
        <div>
          <strong>Programming Languages:</strong>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>C#, SQL, HTML, CSS, JavaScript, C++</li>
          </ul>
          <strong>Frameworks & Technologies:</strong>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>.NET Core, Entity Framework, ASP.NET MVC, REST API, React</li>
          </ul>
          <strong>Architecture & Design:</strong>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Design Patterns (Factory, Repository, Dependency Injection), OOP, Agile, Scrum, Asynchronous Programming</li>
          </ul>
        </div>
        <div>
          <strong>Databases:</strong>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>SQL Server</li>
          </ul>
          <strong>Tools:</strong>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Git, Veracode, SonarQube, Sonatype, CI/CD pipeline</li>
          </ul>
          <strong>Testing:</strong>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Unit Testing, Integration Testing, Moq, xUnit</li>
          </ul>
          <strong>Cloud Platforms:</strong>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>AWS (EC2, Lambda, S3), Azure DevOps</li>
          </ul>
        </div>
      </div>
    </section>

    {/* Experience */}
    <section>
      <h2 style={{ color: '#2b6cb0', fontSize: 20, marginBottom: 8 }}>Professional Experience</h2>
      {/* Enlyte */}
      <div style={{ color: '#4a5568', marginBottom: 16 }}>
        <strong>Enlyte Inc. - Irvine, CA</strong><br />
        Software Engineer | Nov 2017 - Present
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Developed and maintained U.S. Workers’ Compensation-related applications using C#, ASP.NET, .NET, and SQL Server</li>
          <li>Built UI components using HTML, CSS, JavaScript, ASP.NET, and React</li>
          <li>Applied Design Patterns, OOP, and Asynchronous Programming principles in an Agile environment</li>
          <li>Migrated application infrastructure to AWS cloud</li>
          <li>Led initiatives to identify and remediate security vulnerabilities using Veracode, SonarQube, and Sonatype</li>
          <li>Implemented OWASP-compliant secure coding practices</li>
          <li>Mentored new team members through knowledge transfer sessions and code reviews</li>
          <li>Conducted rigorous unit and integration tests using the Moq framework</li>
          <li>Reduced application vulnerabilities by 30 percent</li>
          <li>Reduced system downtime by 20 percent through code optimizations to handle high-traffic volumes</li>
          <li>Improved database performance by 25 percent through optimizing queries</li>
          <li>Recognized with multiple SPOT awards for technical excellence</li>
        </ul>
      </div>
      {/* Technosoft */}
      <div style={{ color: '#4a5568', marginBottom: 16 }}>
        <strong>Technosoft Corporation - Simi Valley, CA</strong><br />
        Software Engineer | Oct 2017 - Nov 2017
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Developed REST APIs and C++/.NET applications for Johnson Controls’ P2000 Access Control System</li>
          <li>Designed and implemented a MVC-based system for centralized event management</li>
          <li>Conducted comprehensive testing to ensure seamless system integration</li>
        </ul>
      </div>
      {/* Syntel */}
      <div style={{ color: '#4a5568' }}>
        <strong>Syntel Ltd. - Mumbai, India</strong><br />
        Software Engineer | Dec 2012 - Jul 2015
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Built a US Medicare-related application for Humana Inc. using C#, .NET, ASP.NET MVC, SQL Server and Agile methodology</li>
          <li>Delivered end-to-end features related to health insurance claims processing</li>
          <li>Executed unit tests and system integration tests for every functionality</li>
          <li>Analyzed user stories, implemented bug-free features, and generated weekly defect reports for management review</li>
          <li>Received “Gold Star” from the client product owner for insightful contributions during sprint planning</li>
          <li>Awarded the ‘SPOT Recognition’ award by Syntel management for dedication to project success</li>
        </ul>
      </div>
    </section>
      </div>
);

const AboutPage: React.FC = () => {
  const { isLoading } = useSessionContext();
  const navigate = useNavigate();

  const handleClose = () => {
      navigate('/'); // ✅ users go to login/home
  };

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Segoe UI, Arial, sans-serif',
        backgroundColor: '#f8f9fa'
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  return <AboutContent onClose={handleClose} />;
};

export default AboutPage;
