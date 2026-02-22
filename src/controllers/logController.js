import ClientErrorLog from '../models/ClientErrorLog.js';

const MAX_CLIENT_LOGS = 200;
const MAX_MESSAGE_LENGTH = 1000;

const clampString = (value, maxLength = MAX_MESSAGE_LENGTH) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
};

const normalizeClientLog = (log) => ({
  timestamp: clampString(log?.timestamp, 100),
  severity: ['error', 'warning', 'info'].includes(log?.severity) ? log.severity : 'error',
  message: clampString(log?.message),
  stack: clampString(log?.stack, 6000),
  context: log?.context && typeof log.context === 'object' ? log.context : {},
  userAgent: clampString(log?.userAgent, 1000),
  url: clampString(log?.url, 2000),
  userId: clampString(log?.userId, 100),
  requestId: clampString(log?.requestId, 200),
  statusCode: Number.isFinite(Number(log?.statusCode)) ? Number(log.statusCode) : undefined,
  path: clampString(log?.path, 1000),
  method: clampString(log?.method, 50),
});

const buildSummary = (logs) => {
  const summary = {
    totalLogs: logs.length,
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
  };

  logs.forEach((log) => {
    if (log.severity === 'warning') summary.warningCount += 1;
    else if (log.severity === 'info') summary.infoCount += 1;
    else summary.errorCount += 1;
  });

  return summary;
};

const makeReportId = () => {
  return `ERR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
};

export const submitClientErrorReport = async (req, res) => {
  try {
    const submittedLogs = Array.isArray(req.body?.logs) ? req.body.logs : [];
    if (submittedLogs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'logs array is required',
        requestId: req.requestId,
      });
    }

    const logs = submittedLogs.slice(-MAX_CLIENT_LOGS).map(normalizeClientLog);
    const reportId = makeReportId();
    const requestId =
      logs.find((log) => log.requestId)?.requestId || req.body?.requestId || req.requestId;

    const report = await ClientErrorLog.create({
      reportId,
      source: clampString(req.body?.source || 'web-client', 50),
      note: clampString(req.body?.note || '', 5000),
      userId: req.user?._id || null,
      submittedUserId: clampString(req.body?.userId || '', 100),
      submittedByEmail: req.user?.email || undefined,
      requestId,
      exportedAt: clampString(req.body?.exportedAt || '', 100),
      logs,
      summary: buildSummary(logs),
      clientMeta: {
        userAgent: clampString(req.headers['user-agent'] || '', 1000),
        currentUrl: clampString(logs[logs.length - 1]?.url || '', 2000),
      },
    });

    console.error(`[CLIENT ERROR REPORT] ${report.reportId}`, {
      requestId: req.requestId,
      reportRequestId: report.requestId,
      userId: req.user?._id?.toString?.() || req.body?.userId || null,
      totalLogs: report.summary?.totalLogs,
      errorCount: report.summary?.errorCount,
    });

    return res.status(201).json({
      success: true,
      message: 'Client error report received',
      requestId: req.requestId,
      data: {
        reportId: report.reportId,
        totalLogs: report.summary?.totalLogs || 0,
      },
    });
  } catch (error) {
    console.error('Submit client error report failed:', {
      requestId: req.requestId,
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: 'Server error while saving client error report',
      requestId: req.requestId,
    });
  }
};

export const getClientErrorReports = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.reportId) {
      query.reportId = req.query.reportId;
    }
    if (req.query.requestId) {
      query.requestId = req.query.requestId;
    }

    const [reports, total] = await Promise.all([
      ClientErrorLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          'reportId source note requestId submittedByEmail submittedUserId summary createdAt updatedAt'
        )
        .lean(),
      ClientErrorLog.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      requestId: req.requestId,
      data: reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get client error reports failed:', {
      requestId: req.requestId,
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving client error reports',
      requestId: req.requestId,
    });
  }
};

export const getClientErrorReportById = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await ClientErrorLog.findOne({ reportId }).lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Client error report not found',
        requestId: req.requestId,
      });
    }

    return res.status(200).json({
      success: true,
      requestId: req.requestId,
      data: report,
    });
  } catch (error) {
    console.error('Get client error report by id failed:', {
      requestId: req.requestId,
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving client error report',
      requestId: req.requestId,
    });
  }
};
