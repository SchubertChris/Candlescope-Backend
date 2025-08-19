// models/Project/Project.js
// VOLLSTÄNDIGES PROJECT MODEL
import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  // Basis-Informationen
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['website', 'ecommerce', 'newsletter', 'bewerbung', 'portfolio', 'custom'],
    required: true
  },
  
  // Status und Fortschritt
  status: {
    type: String,
    enum: ['planning', 'inProgress', 'review', 'completed', 'cancelled'],
    default: 'planning'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Termine
  deadline: {
    type: Date,
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  completedDate: {
    type: Date
  },
  
  // Zuweisungen
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  assignedAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Zähler
  messagesCount: {
    type: Number,
    default: 0
  },
  filesCount: {
    type: Number,
    default: 0
  },
  
  // Meta-Daten
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Budget/Kosten (optional)
  budget: {
    type: Number,
    min: 0
  },
  actualCost: {
    type: Number,
    min: 0,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// ===========================
// INDEXES FÜR PERFORMANCE
// ===========================
projectSchema.index({ customerId: 1, isActive: 1 });
projectSchema.index({ assignedAdmin: 1, isActive: 1 });
projectSchema.index({ status: 1, deadline: 1 });
projectSchema.index({ createdAt: -1 });

// ===========================
// VIRTUELLE FELDER
// ===========================
projectSchema.virtual('isOverdue').get(function() {
  return this.deadline < new Date() && this.status !== 'completed';
});

projectSchema.virtual('daysUntilDeadline').get(function() {
  const now = new Date();
  const deadline = new Date(this.deadline);
  const diffTime = deadline - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

projectSchema.virtual('statusColor').get(function() {
  const colors = {
    planning: '#3b82f6',
    inProgress: '#f59e0b',
    review: '#8b5cf6',
    completed: '#10b981',
    cancelled: '#ef4444'
  };
  return colors[this.status] || '#6b7280';
});

// ===========================
// INSTANCE METHODS
// ===========================
projectSchema.methods.canUserAccess = function(user) {
  if (user.role === 'admin') {
    return this.assignedAdmin.toString() === user._id.toString();
  } else if (user.role === 'kunde') {
    return this.customerId.toString() === user._id.toString();
  }
  return false;
};

projectSchema.methods.updateProgress = function(newProgress) {
  this.progress = Math.max(0, Math.min(100, newProgress));
  
  if (newProgress === 100 && this.status !== 'completed') {
    this.status = 'completed';
    this.completedDate = new Date();
  } else if (newProgress > 0 && this.status === 'planning') {
    this.status = 'inProgress';
  }
  
  return this.save();
};

projectSchema.methods.addMessage = function() {
  this.messagesCount += 1;
  return this.save();
};

projectSchema.methods.addFile = function() {
  this.filesCount += 1;
  return this.save();
};

// ===========================
// STATIC METHODS
// ===========================
projectSchema.statics.findByUser = function(user) {
  let query = { isActive: true };
  
  if (user.role === 'admin') {
    query.assignedAdmin = user._id;
  } else if (user.role === 'kunde') {
    query.customerId = user._id;
  }
  
  return this.find(query)
    .populate('customerId', 'firstName lastName email company')
    .populate('assignedAdmin', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

projectSchema.statics.findActiveByAdmin = function(adminId) {
  return this.find({
    assignedAdmin: adminId,
    isActive: true,
    status: { $in: ['planning', 'inProgress', 'review'] }
  })
  .populate('customerId', 'firstName lastName email company')
  .sort({ deadline: 1 });
};

projectSchema.statics.findOverdue = function(adminId = null) {
  let query = {
    isActive: true,
    status: { $ne: 'completed' },
    deadline: { $lt: new Date() }
  };
  
  if (adminId) {
    query.assignedAdmin = adminId;
  }
  
  return this.find(query)
    .populate('customerId', 'firstName lastName email company')
    .populate('assignedAdmin', 'firstName lastName email')
    .sort({ deadline: 1 });
};

projectSchema.statics.getStatsByAdmin = async function(adminId) {
  const stats = await this.aggregate([
    { $match: { assignedAdmin: adminId, isActive: true } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProgress: { $avg: '$progress' }
      }
    }
  ]);
  
  const result = {
    total: 0,
    planning: 0,
    inProgress: 0,
    review: 0,
    completed: 0,
    avgProgress: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
    if (stat._id !== 'completed') {
      result.avgProgress = (result.avgProgress + stat.avgProgress) / 2;
    }
  });
  
  return result;
};

// ===========================
// MIDDLEWARE
// ===========================
projectSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'completed' && !this.completedDate) {
    this.completedDate = new Date();
    this.progress = 100;
  }
  
  if (this.isModified('status') && this.status !== 'completed') {
    this.completedDate = undefined;
  }
  
  next();
});

export default mongoose.model('Project', projectSchema);