function field(column, options = {}) {
  return { column, ...options };
}

const JSON_FIELD = { serialize: JSON.stringify, parse: (value) => {
  if (value === null || value === undefined || value === '') return [];
  if (typeof value !== 'string') return value;
  return JSON.parse(value);
} };

const JSON_OBJECT_FIELD = { serialize: JSON.stringify, parse: (value) => {
  if (value === null || value === undefined || value === '') return {};
  if (typeof value !== 'string') return value;
  return JSON.parse(value);
} };

const BOOLEAN_FIELD = {
  serialize: (value) => (value ? 1 : 0),
  parse: (value) => Boolean(Number(value))
};

const MONEY_FIELD = {
  serialize: (value) => Math.round(Number(value || 0) * 100),
  parse: (value) => Number(value || 0) / 100
};

const EMPTY_AS_NULL_FIELD = {
  serialize: (value) => (String(value || '').trim() ? value : null)
};

function definition(table, fields) {
  return { table, idColumn: 'id', fields };
}

const TABLE_DEFINITIONS = {
  users: definition('app_users', {
    id: field('id'),
    openid: field('openid', EMPTY_AS_NULL_FIELD),
    wechatSessionKey: field('wechat_session_key'),
    unionid: field('unionid', EMPTY_AS_NULL_FIELD),
    phone: field('phone', EMPTY_AS_NULL_FIELD),
    nickname: field('nickname'),
    avatar: field('avatar'),
    currentRole: field('current_role'),
    roles: field('roles_json', JSON_FIELD),
    profileStatus: field('profile_status'),
    accountUsername: field('account_username', EMPTY_AS_NULL_FIELD),
    accountPasswordHash: field('account_password_hash'),
    accountStatus: field('account_status'),
    failedLoginCount: field('failed_login_count'),
    lockedUntil: field('locked_until'),
    freezeReason: field('freeze_reason'),
    registeredAt: field('registered_at'),
    lastLoginAt: field('last_login_at'),
    updatedAt: field('updated_at')
  }),
  parentProfiles: definition('parent_profiles', {
    id: field('id'),
    userId: field('user_id'),
    parentName: field('parent_name'),
    phone: field('phone', EMPTY_AS_NULL_FIELD),
    district: field('district'),
    childGrade: field('child_grade'),
    subjects: field('subjects_json', JSON_FIELD),
    availableTime: field('available_time_json', JSON_FIELD),
    childSituation: field('child_situation'),
    teacherRequirement: field('teacher_requirement'),
    remark: field('remark'),
    createdAt: field('created_at'),
    updatedAt: field('updated_at')
  }),
  teachers: definition('teachers', {
    id: field('id'),
    userId: field('user_id'),
    realName: field('real_name'),
    gender: field('gender'),
    phone: field('phone'),
    contactWechat: field('contact_wechat'),
    school: field('school'),
    major: field('major'),
    grade: field('grade'),
    avatar: field('avatar'),
    introduction: field('introduction'),
    teachingExperience: field('teaching_experience'),
    gaokaoScore: field('gaokao_score'),
    englishLevel: field('english_level'),
    teacherCertificate: field('teacher_certificate'),
    competitionExperience: field('competition_experience'),
    abilityProofText: field('ability_proof_text'),
    suitableTags: field('suitable_tags_json', JSON_FIELD),
    hourlyRate: field('hourly_rate_cents', MONEY_FIELD),
    serviceAreas: field('service_areas_json', JSON_FIELD),
    availableTimes: field('available_times_json', JSON_FIELD),
    auditStatus: field('audit_status'),
    orderStatus: field('order_status'),
    rating: field('rating'),
    completedOrderCount: field('completed_order_count'),
    isRecommended: field('is_recommended', BOOLEAN_FIELD),
    rejectReason: field('reject_reason'),
    bannedReason: field('banned_reason'),
    createdAt: field('created_at'),
    updatedAt: field('updated_at')
  }),
  teacherSubjects: definition('teacher_subjects', {
    id: field('id'),
    teacherId: field('teacher_id'),
    subject: field('subject'),
    teachGrade: field('teach_grade'),
    createdAt: field('created_at')
  }),
  teacherCertifications: definition('teacher_certifications', {
    id: field('id'),
    teacherId: field('teacher_id'),
    materialType: field('material_type'),
    imageUrl: field('image_url'),
    auditStatus: field('audit_status'),
    uploadedAt: field('uploaded_at')
  }),
  orders: definition('tutor_orders', {
    id: field('id'),
    orderNo: field('order_no'),
    parentUserId: field('parent_user_id'),
    teacherId: field('teacher_id'),
    subject: field('subject'),
    studentGrade: field('student_grade'),
    appointmentDate: field('appointment_date'),
    startTime: field('start_time'),
    endTime: field('end_time'),
    serviceArea: field('service_area'),
    address: field('address'),
    contactName: field('contact_name'),
    contactPhone: field('contact_phone'),
    note: field('note'),
    status: field('status'),
    rejectReason: field('reject_reason'),
    closeReason: field('close_reason'),
    previousStatus: field('previous_status'),
    createdAt: field('created_at'),
    updatedAt: field('updated_at')
  }),
  orderStatusLogs: definition('order_status_logs', {
    id: field('id'),
    orderId: field('order_id'),
    fromStatus: field('from_status'),
    toStatus: field('to_status'),
    actorType: field('actor_type'),
    actorId: field('actor_id'),
    reason: field('reason'),
    createdAt: field('created_at')
  }),
  reviews: definition('reviews', {
    id: field('id'),
    orderId: field('order_id'),
    parentUserId: field('parent_user_id'),
    teacherId: field('teacher_id'),
    starRating: field('star_rating'),
    attitudeRating: field('attitude_rating'),
    punctualityRating: field('punctuality_rating'),
    clarityRating: field('clarity_rating'),
    childAcceptanceRating: field('child_acceptance_rating'),
    content: field('content'),
    isVisible: field('is_visible', BOOLEAN_FIELD),
    hiddenReason: field('hidden_reason'),
    createdAt: field('created_at'),
    updatedAt: field('updated_at')
  }),
  complaints: definition('complaints', {
    id: field('id'),
    complaintNo: field('complaint_no'),
    orderId: field('order_id'),
    complainantUserId: field('complainant_user_id'),
    complainantRole: field('complainant_role'),
    targetUserId: field('target_user_id'),
    reason: field('reason'),
    description: field('description'),
    images: field('images_json', JSON_FIELD),
    status: field('status'),
    result: field('result'),
    handlerAdminId: field('handler_admin_id'),
    createdAt: field('created_at'),
    updatedAt: field('updated_at')
  }),
  parentRequirements: definition('parent_requirements', {
    id: field('id'),
    parentUserId: field('parent_user_id'),
    parentDisplayName: field('parent_display_name'),
    district: field('district'),
    childGrade: field('child_grade'),
    subject: field('subject'),
    expectedTime: field('expected_time'),
    budgetPrice: field('budget_price_cents', MONEY_FIELD),
    studySituation: field('study_situation'),
    teacherRequirement: field('teacher_requirement'),
    contactPhone: field('contact_phone'),
    contactWechat: field('contact_wechat'),
    contactVisibleConsent: field('contact_visible_consent', BOOLEAN_FIELD),
    status: field('status'),
    isRecommended: field('is_recommended', BOOLEAN_FIELD),
    createdAt: field('created_at'),
    updatedAt: field('updated_at')
  }),
  unlockRecords: definition('unlock_records', {
    id: field('id'),
    buyerUserId: field('buyer_user_id'),
    buyerRole: field('buyer_role'),
    targetType: field('target_type'),
    targetId: field('target_id'),
    amount: field('amount_cents', MONEY_FIELD),
    payStatus: field('pay_status'),
    payOrderNo: field('pay_order_no'),
    unlockStatus: field('unlock_status'),
    createdAt: field('created_at'),
    paidAt: field('paid_at'),
    expiredAt: field('expired_at')
  }),
  paymentOrders: definition('payment_orders', {
    id: field('id'),
    orderNo: field('order_no'),
    merchantOrderNo: field('merchant_order_no', EMPTY_AS_NULL_FIELD),
    channelTransactionId: field('channel_transaction_id'),
    buyerUserId: field('buyer_user_id'),
    buyerRole: field('buyer_role'),
    targetType: field('target_type'),
    targetId: field('target_id'),
    amount: field('amount_cents', MONEY_FIELD),
    payStatus: field('pay_status'),
    payMode: field('pay_mode'),
    payChannel: field('pay_channel'),
    callbackStatus: field('callback_status'),
    idempotencyKey: field('idempotency_key', EMPTY_AS_NULL_FIELD),
    refundStatus: field('refund_status'),
    refundAmount: field('refund_amount_cents', MONEY_FIELD),
    createdAt: field('created_at'),
    paidAt: field('paid_at'),
    refundedAt: field('refunded_at'),
    closedAt: field('closed_at'),
    updatedAt: field('updated_at')
  }),
  contactLogs: definition('contact_logs', {
    id: field('id'),
    userId: field('user_id'),
    role: field('role'),
    targetType: field('target_type'),
    targetId: field('target_id'),
    contactStatus: field('contact_status'),
    note: field('note'),
    createdAt: field('created_at'),
    updatedAt: field('updated_at')
  }),
  phoneVerifications: definition('phone_verifications', {
    id: field('id'),
    phone: field('phone', EMPTY_AS_NULL_FIELD),
    code: field('code'),
    failedCount: field('failed_count'),
    lockedUntil: field('locked_until'),
    expiresAt: field('expires_at'),
    createdAt: field('created_at'),
    updatedAt: field('updated_at')
  }),
  admins: definition('admin_users', {
    id: field('id'),
    username: field('username'),
    phone: field('phone'),
    passwordHash: field('password_hash'),
    role: field('role'),
    status: field('status'),
    accountStatus: field('account_status'),
    failedLoginCount: field('failed_login_count'),
    lockedUntil: field('locked_until'),
    lastLoginAt: field('last_login_at'),
    lastLoginTime: field('last_login_time'),
    createdAt: field('created_at'),
    updatedAt: field('updated_at')
  }),
  adminLoginTickets: definition('admin_login_tickets', {
    id: field('id'),
    ticket: field('ticket'),
    adminId: field('admin_id'),
    used: field('used', BOOLEAN_FIELD),
    expiredAt: field('expired_at'),
    createdAt: field('created_at'),
    usedAt: field('used_at'),
    updatedAt: field('updated_at')
  }),
  tokenRevocations: definition('token_revocations', {
    id: field('id'),
    tokenHash: field('token_hash'),
    tokenType: field('token_type'),
    subjectId: field('subject_id'),
    expiredAt: field('expired_at'),
    revokedAt: field('revoked_at')
  }),
  operationLogs: definition('admin_operation_logs', {
    id: field('id'),
    adminId: field('admin_id'),
    action: field('action'),
    targetType: field('target_type'),
    targetId: field('target_id'),
    detail: field('detail'),
    payload: field('payload_json', JSON_OBJECT_FIELD),
    createdAt: field('created_at')
  }),
  frontendConfigs: definition('frontend_configs', {
    id: field('id'),
    configKey: field('config_key'),
    configValue: field('config_value_json', JSON_OBJECT_FIELD),
    configType: field('config_type'),
    description: field('description'),
    enabled: field('enabled', BOOLEAN_FIELD),
    isPublic: field('is_public', BOOLEAN_FIELD),
    createdAt: field('created_at'),
    updatedAt: field('updated_at')
  }),
  uploadedFiles: definition('uploaded_files', {
    id: field('id'),
    ownerUserId: field('owner_user_id'),
    purpose: field('purpose'),
    storageProvider: field('storage_provider'),
    storageKey: field('storage_key'),
    publicUrl: field('public_url'),
    mimeType: field('mime_type'),
    sizeBytes: field('size_bytes'),
    status: field('status'),
    createdAt: field('created_at'),
    updatedAt: field('updated_at')
  })
};

const PERSISTED_TABLES = Object.keys(TABLE_DEFINITIONS);

module.exports = {
  TABLE_DEFINITIONS,
  PERSISTED_TABLES
};
