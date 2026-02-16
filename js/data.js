/* ===================================================
   ProcessReview — Sample Data
   =================================================== */

const COLORS = {
  blue: '#6366f1',
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  purple: '#8b5cf6',
  teal: '#14b8a6',
  pink: '#ec4899',
};

const AVATAR_COLORS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #10b981, #14b8a6)',
  'linear-gradient(135deg, #f59e0b, #f97316)',
  'linear-gradient(135deg, #ef4444, #ec4899)',
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
  'linear-gradient(135deg, #06b6d4, #3b82f6)',
];

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function randomDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d;
}

function formatDate(date) {
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const DEPARTMENTS = ['Engineering', 'Operations', 'Finance', 'HR', 'Marketing', 'Legal'];
const STATUSES = ['pending', 'in-review', 'approved', 'rejected'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const TEAM_MEMBERS = [
  { name: 'Sarah Chen', role: 'Senior Reviewer', dept: 'Engineering', status: 'online', reviews: 47, approved: 42, avgTime: '1.2d' },
  { name: 'Marcus Johnson', role: 'Process Lead', dept: 'Operations', status: 'online', reviews: 38, approved: 35, avgTime: '1.8d' },
  { name: 'Emily Rodriguez', role: 'Compliance Officer', dept: 'Legal', status: 'busy', reviews: 31, approved: 28, avgTime: '2.1d' },
  { name: 'James Wilson', role: 'QA Manager', dept: 'Engineering', status: 'online', reviews: 29, approved: 25, avgTime: '1.5d' },
  { name: 'Aisha Patel', role: 'Finance Analyst', dept: 'Finance', status: 'offline', reviews: 24, approved: 22, avgTime: '2.4d' },
  { name: 'David Kim', role: 'HR Specialist', dept: 'HR', status: 'online', reviews: 22, approved: 20, avgTime: '1.9d' },
  { name: 'Lisa Thompson', role: 'Marketing Ops', dept: 'Marketing', status: 'offline', reviews: 18, approved: 16, avgTime: '2.0d' },
  { name: 'Robert Garcia', role: 'DevOps Lead', dept: 'Engineering', status: 'busy', reviews: 15, approved: 14, avgTime: '1.1d' },
];

const PROCESS_NAMES = [
  'Employee Onboarding Workflow v3',
  'Quarterly Budget Approval',
  'Software Release Pipeline',
  'Vendor Risk Assessment',
  'Customer Refund Process',
  'Data Privacy Compliance Check',
  'Infrastructure Change Request',
  'Marketing Campaign Approval',
  'New Hire Benefits Enrollment',
  'Security Incident Response',
  'Product Launch Checklist',
  'Annual Performance Review',
  'Purchase Order Authorization',
  'Code Review Standards Update',
  'Expense Reimbursement Flow',
  'Client Contract Review',
  'Disaster Recovery Protocol',
  'Feature Flag Rollout Process',
  'Compliance Audit Workflow',
  'Cross-team Escalation Protocol',
];

const PROCESS_DESCRIPTIONS = [
  'Streamlined onboarding process including IT setup, documentation, and team introductions.',
  'Multi-stage budget approval workflow with department head and CFO sign-off requirements.',
  'End-to-end release pipeline covering build, test, staging, and production deployment.',
  'Comprehensive vendor evaluation covering security, compliance, and financial stability.',
  'Customer-facing refund process with automated eligibility checks and approval routing.',
  'GDPR and CCPA compliance verification process for data handling procedures.',
  'Change management workflow for infrastructure modifications with rollback planning.',
  'Campaign review process including brand guidelines, legal review, and budget approval.',
  'Benefits enrollment automation for new employees with provider integration.',
  'Incident response playbook with severity classification and escalation procedures.',
  'Product launch coordination checklist spanning marketing, engineering, and support.',
  'Annual review cycle management with self-assessment, peer feedback, and calibration.',
  'Purchase authorization workflow with dynamic approval thresholds based on amount.',
  'Updated code review guidelines enforcing security, performance, and maintainability standards.',
  'Expense claim submission and approval flow with receipt verification and policy checks.',
  'Legal contract review process with clause analysis and risk assessment.',
  'DR protocol testing and validation workflow with recovery time objectives.',
  'Feature flag lifecycle management from creation through rollout to cleanup.',
  'Regulatory compliance audit workflow with evidence collection and gap analysis.',
  'Cross-functional escalation process with SLA tracking and resolution documentation.',
];

// Generate process data
const processes = [];
for (let i = 0; i < 20; i++) {
  const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
  const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)];
  const owner = TEAM_MEMBERS[Math.floor(Math.random() * TEAM_MEMBERS.length)];
  const dept = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
  const date = randomDate(30);
  const progress = status === 'approved' ? 100 :
                   status === 'rejected' ? Math.floor(Math.random() * 40) + 30 :
                   status === 'in-review' ? Math.floor(Math.random() * 30) + 50 :
                   Math.floor(Math.random() * 30) + 10;

  processes.push({
    id: `PR-${(1000 + i).toString()}`,
    name: PROCESS_NAMES[i],
    description: PROCESS_DESCRIPTIONS[i],
    department: dept,
    owner: owner.name,
    status: status,
    priority: priority,
    date: date,
    progress: progress,
    comments: Math.floor(Math.random() * 12),
    steps: Math.floor(Math.random() * 6) + 3,
    completedSteps: Math.floor(Math.random() * 5) + 1,
  });
}

// Sort by date
processes.sort((a, b) => b.date - a.date);

const NOTIFICATIONS = [
  { type: 'blue', icon: 'comment', text: '<strong>Sarah Chen</strong> commented on <strong>PR-1003</strong>', time: new Date(Date.now() - 15 * 60000), unread: true },
  { type: 'green', icon: 'check', text: '<strong>PR-1007</strong> was approved by <strong>Marcus Johnson</strong>', time: new Date(Date.now() - 45 * 60000), unread: true },
  { type: 'red', icon: 'x', text: '<strong>PR-1012</strong> was sent back for revision', time: new Date(Date.now() - 2 * 3600000), unread: true },
  { type: 'blue', icon: 'user', text: '<strong>Emily Rodriguez</strong> was assigned to <strong>PR-1015</strong>', time: new Date(Date.now() - 4 * 3600000), unread: false },
  { type: 'green', icon: 'check', text: '<strong>PR-1002</strong> completed all review stages', time: new Date(Date.now() - 8 * 3600000), unread: false },
  { type: 'blue', icon: 'file', text: 'New process <strong>PR-1019</strong> was submitted', time: new Date(Date.now() - 12 * 3600000), unread: false },
];

const ACTIVITY_TIMELINE = [
  { type: 'green', icon: 'check', text: '<strong>Sarah Chen</strong> approved <strong>Employee Onboarding Workflow v3</strong>', time: new Date(Date.now() - 25 * 60000) },
  { type: 'blue', icon: 'comment', text: '<strong>James Wilson</strong> left feedback on <strong>Software Release Pipeline</strong>', time: new Date(Date.now() - 55 * 60000) },
  { type: 'amber', icon: 'clock', text: '<strong>Quarterly Budget Approval</strong> is awaiting review from Finance', time: new Date(Date.now() - 2 * 3600000) },
  { type: 'purple', icon: 'user', text: '<strong>Aisha Patel</strong> was assigned to <strong>Vendor Risk Assessment</strong>', time: new Date(Date.now() - 3 * 3600000) },
  { type: 'red', icon: 'x', text: '<strong>Marcus Johnson</strong> requested changes on <strong>Infrastructure Change Request</strong>', time: new Date(Date.now() - 5 * 3600000) },
  { type: 'blue', icon: 'file', text: '<strong>Data Privacy Compliance Check</strong> was submitted for review', time: new Date(Date.now() - 7 * 3600000) },
  { type: 'green', icon: 'check', text: '<strong>Emily Rodriguez</strong> completed compliance review of <strong>Client Contract Review</strong>', time: new Date(Date.now() - 10 * 3600000) },
];

// Chart data
const CHART_DATA = {
  activityLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  submitted: [18, 22, 25, 20, 28, 30, 35, 32, 38, 40, 42, 45],
  approved: [14, 18, 20, 17, 24, 26, 30, 28, 34, 36, 38, 40],
  rejected: [2, 3, 3, 2, 3, 2, 3, 2, 2, 2, 3, 3],

  statusDistribution: {
    labels: ['Approved', 'In Review', 'Pending', 'Rejected'],
    values: [142, 52, 34, 19],
    colors: [COLORS.green, COLORS.blue, COLORS.amber, COLORS.red],
  },

  cycleTime: {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'],
    values: [4.2, 3.8, 3.5, 3.1, 2.9, 2.7, 2.5, 2.4],
  },

  departmentReviews: {
    labels: ['Engineering', 'Operations', 'Finance', 'HR', 'Marketing', 'Legal'],
    values: [68, 52, 42, 35, 28, 22],
    colors: [COLORS.blue, COLORS.green, COLORS.amber, COLORS.purple, COLORS.pink, COLORS.teal],
  },

  workload: {
    labels: ['Sarah C.', 'Marcus J.', 'Emily R.', 'James W.', 'Aisha P.', 'David K.'],
    active: [8, 6, 7, 5, 4, 3],
    completed: [39, 32, 24, 24, 20, 19],
  },

  throughput: {
    labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
    values: [32, 36, 38, 40, 42, 45],
  },
};
