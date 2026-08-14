import React from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useNavigate } from 'react-router-dom';

const cardStyle: React.CSSProperties = {
  background: '#f7fafc',
  padding: 20,
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
};

const readmeHighlights = [
  {
    title: 'Personal Finance Insights',
    description:
      'PennyWize tracks income, expenses, savings goals, and financial history so users can understand their money in one place.',
  },
  {
    title: 'AI Suggestions',
    description:
      'The app uses OpenAI-powered suggestions with a cost-conscious model strategy for short-term, long-term, goal-based, and concise financial guidance.',
  },
  {
    title: 'Secure API Access',
    description:
      'Suggestion generation is protected by Supabase authentication so only signed-in users can request personalized advice.',
  },
  {
    title: 'Operational Visibility',
    description:
      'The backend records high-level audit events such as request outcomes, authentication results, validation failures, and suggestion generation activity.',
  },
  {
    title: 'Database Performance',
    description:
      'Supabase and PostgreSQL are tuned with targeted indexes and optimized queries for finance history, preferences, goals, and reporting workflows.',
  },
  {
    title: 'Modern Web Stack',
    description:
      'The frontend is built with React, TypeScript, Vite, responsive UI patterns, and Vercel deployment for a fast web experience.',
  },
  {
    title: 'Privacy-Conscious Documentation',
    description:
      'This public overview intentionally stays high level and does not expose API keys, environment variable values, project references, or financial input values.',
  },
];

const resumeSkillGroups = [
  {
    title: 'Languages',
    items: ['C#', 'SQL', 'JavaScript', 'TypeScript'],
  },
  {
    title: 'Frameworks & Libraries',
    items: ['.NET Core', 'ASP.NET MVC', 'ASP.NET Web API', 'Entity Framework', 'React', 'Node.js'],
  },
  {
    title: 'AI & Developer Productivity',
    items: ['AI-assisted development', 'AI coding assistants', 'ChatGPT', 'GitHub Copilot', 'Prompt engineering', 'AI-generated code review'],
  },
  {
    title: 'Cloud & DevOps',
    items: ['AWS EC2', 'AWS Lambda', 'AWS S3', 'Vercel', 'Azure DevOps', 'CI/CD pipelines', 'Git', 'GitHub'],
  },
  {
    title: 'Databases & Data',
    items: ['SQL Server', 'T-SQL', 'PostgreSQL/Supabase', 'Database indexing', 'Query optimization', 'Database performance optimization', 'ETL pipelines'],
  },
  {
    title: 'Architecture & APIs',
    items: ['REST APIs', 'Web APIs', 'API design', 'Microservices', 'Distributed systems', 'Event-driven architecture', 'System design', 'Scalable web applications', 'Real-time scheduling systems'],
  },
  {
    title: 'Security & Authentication',
    items: ['OWASP', 'Veracode', 'SonarQube', 'RBAC', 'Row-Level Security', 'Authentication', 'Session management', 'API security', 'Audit logging'],
  },
  {
    title: 'Testing & Quality',
    items: ['xUnit', 'Moq', 'Integration testing', 'End-to-end testing', 'System integration testing', 'Automated testing', 'Debugging', 'Performance optimization', 'Production support'],
  },
  {
    title: 'Engineering Leadership',
    items: ['Code reviews', 'Technical design', 'Agile', 'Sprint planning', 'Mentoring', 'Technical leadership'],
  },
];

const resumeExperience = [
  {
    company: 'T.E. Roberts Inc. - Irvine, CA',
    role: 'Software Engineer',
    dates: 'Nov 2025 - May 2026',
    bullets: [
      'Designed and launched the initial production version of a scheduling and project-management platform within seven days, then expanded it into a daily operational tool for field and office teams.',
      'Built paving, vacuum, assignment, and project-scheduling workflows with drag-and-drop planning, recurring schedules, timeline management, employee and equipment assignments, searchable datasets, and PDF schedule generation.',
      'Implemented end-to-end project lifecycle management, including project creation, archive and restoration workflows, project-specific permissions, audit logging, autosave, multi-project assignments, report tracking, and profit-and-loss modules.',
      'Developed inventory, equipment, workforce, media, and project-documentation systems supported by normalized PostgreSQL schemas and Node.js ETL pipelines for Excel data ingestion.',
      'Improved security, performance, scalability, and maintainability through row-level security, role-based access, database indexing, caching, modular refactoring, and automated testing.',
      'Delivered interactive Gantt planning, responsive desktop and mobile experiences, PWA support, SMS and email workflows, push notifications, reporting dashboards, and PDF export capabilities.',
    ],
    tech:
      'React, TypeScript, Node.js, PostgreSQL/Supabase, Row-Level Security, Vercel, Progressive Web Apps, REST APIs, drag-and-drop interfaces, PDF generation, authentication and authorization, Git, Excel import/export, notification systems',
    links: [{ label: 'Application', href: 'https://ter-tools.vercel.app/' }],
  },
  {
    company: 'Enlyte Inc. - Irvine, CA',
    role: 'Software Engineer II',
    dates: 'Nov 2017 - Apr 2025',
    bullets: [
      'Delivered large-scale workers compensation software solutions used by thousands of U.S. adjusters and medical staff.',
      'Modernized monolithic .NET applications into AWS-based microservices, reducing hosting costs and improving reliability.',
      'Improved application uptime by 20% through performance optimization and asynchronous redesign of high-traffic endpoints.',
      'Optimized SQL queries and database indexes, increasing database throughput by 25%.',
      'Remediated Veracode and SonarQube findings, reducing exploitable security risks by 30%.',
      'Built modern React components that improved page-load performance and accessibility.',
      'Led an onshore and offshore team for two years, driving sprint planning, code reviews, and technical design.',
      'Earned multiple SPOT Awards for innovation, leadership, and cross-team partnership.',
    ],
    tech:
      'C#, .NET Core, ASP.NET MVC, Entity Framework, SQL Server, React, JavaScript, AWS EC2, AWS Lambda, AWS S3, Azure DevOps, REST APIs, microservices, Git',
  },
  {
    company: 'Technosoft Corporation - Simi Valley, CA',
    role: 'Software Engineer',
    dates: 'Oct 2017 - Nov 2017',
    bullets: [
      'Built REST APIs and .NET/C++ modules for Johnson Controls P2000 Access Control System.',
      'Developed event-driven components and dynamic monitoring UI.',
      'Executed system integration testing to ensure cross-module consistency.',
    ],
    tech: 'C#, .NET, C++, REST APIs, event-driven architecture, integration testing',
  },
];

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

    {/* Keep this high-level overview aligned with README.md whenever README.md changes. */}
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 22, marginBottom: 8 }}>Application Overview</h2>
      <div style={cardStyle}>
        <p style={{ color: '#4a5568', marginTop: 0 }}>
          PennyWize combines personal finance tracking, AI-assisted suggestions, secure API access,
          auditability, database performance work, and a modern React deployment stack.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {readmeHighlights.map((item) => (
            <div key={item.title}>
              <h3 style={{ color: '#2d3748', fontSize: 17, margin: '0 0 6px' }}>{item.title}</h3>
              <p style={{ color: '#4a5568', margin: 0 }}>{item.description}</p>
            </div>
          ))}
        </div>
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
          Bellevue, WA 98005 &nbsp;|&nbsp; (562) 331-9226 &nbsp;|&nbsp; gaurav.palande147@gmail.com
        </div>
        <div style={{ marginBottom: 8 }}>
          <a href="https://www.linkedin.com/in/gaurav-palande-50549550" target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce', marginRight: 16 }}>LinkedIn</a>
          <a href="https://github.com/gauravpalande" target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce', marginRight: 16 }}>GitHub</a>
          <a href="https://pennywize.vercel.app/app/about" target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce' }}>Portfolio</a>
        </div>
      </div>
    </section>

    {/* Summary, Certifications, Education */}
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 20, marginBottom: 8 }}>Professional Summary</h2>
      <p style={{ color: '#4a5568' }}>
        Full-stack and backend Software Engineer with 8+ years of experience building and modernizing scalable enterprise applications. Specialized in C#, .NET, AWS, SQL Server, React, TypeScript, microservices, and system design. Proven success improving application performance, reliability, security, and database efficiency across cloud and web platforms. Experienced in leading Agile teams, mentoring engineers, and delivering complex features from design through production. Recently launched the initial production version of a scheduling and project-management platform within seven days, then expanded it into a daily operational tool using React, TypeScript, Node.js, PostgreSQL/Supabase, and Vercel.
      </p>
    </section>

    {/* Skills */}
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 20, marginBottom: 8 }}>Technical Skills</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {resumeSkillGroups.map((group) => (
          <div key={group.title} style={cardStyle}>
            <strong>{group.title}:</strong>
            <p style={{ color: '#4a5568', margin: '6px 0 0' }}>{group.items.join(', ')}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Experience */}
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 20, marginBottom: 8 }}>Professional Experience</h2>
      {resumeExperience.map((job) => (
        <div key={`${job.company}-${job.dates}`} style={{ color: '#4a5568', marginBottom: 16 }}>
          <strong>{job.company}</strong><br />
          {job.role} | {job.dates}
          <ul style={{ margin: '6px 0 8px', paddingLeft: 20 }}>
            {job.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <div><strong>Tech:</strong> {job.tech}</div>
          {job.links && (
            <div style={{ marginTop: 6 }}>
              {job.links.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce', marginRight: 16 }}>
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>

    <section style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 20, marginBottom: 8 }}>Selected Project</h2>
      <div style={{ color: '#4a5568' }}>
        <strong>PennyWize - Full-Stack Personal Finance Application</strong>
        <p>
          Developed and deployed a full-stack personal finance application with responsive UI,
          secure authentication, reusable components, financial workflows, and Vercel-based cloud deployment.
        </p>
        <a href="https://pennywize.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce', marginRight: 16 }}>Application</a>
        <a href="https://github.com/gauravpalande/StingyHubby_frontend-react-finance" target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce' }}>GitHub</a>
      </div>
    </section>

    <section style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 20, marginBottom: 8 }}>Certification</h2>
      <ul style={{ color: '#4a5568', margin: 0, paddingLeft: 20 }}>
        <li>AWS Certified Cloud Practitioner | Amazon Web Services | 2024</li>
      </ul>
    </section>

    <section style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#2b6cb0', fontSize: 20, marginBottom: 8 }}>Education</h2>
      <div style={{ color: '#4a5568', marginBottom: 8 }}>
        <strong>Master of Science in Computer Science</strong><br />
        California State University, Long Beach<br />
        GPA: 3.8 | Phi Kappa Phi Honors | Aug 2015 - May 2017
      </div>
      <div style={{ color: '#4a5568' }}>
        <strong>Bachelor of Engineering in Computer Engineering</strong><br />
        University of Mumbai<br />
        GPA: 3.6 | Jul 2008 - May 2012
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
