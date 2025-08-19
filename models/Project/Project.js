// Backend/models/Project/Project.js
// NEU: Projekt-Model mit Datenschutz und Rollen
import mongoose from "mongoose"; // ✅ statt require

const projectSchema = new mongoose.Schema({
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
    enum: ['website', 'newsletter', 'bewerbung', 'ecommerce', 'custom'],
    required: true
  },
  
  status: {
    type: String,
    enum: ['planning', 'inProgress', 'review', 'completed'],
    default: 'planning'
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  
  // WICHTIG: Datenschutz - Kunde kann nur eigene Projekte sehen
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Admin der das Projekt betreut
  assignedAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  deadline: {
    type: Date,
    required: true
  },
  
  // Projekt-Aktivität
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Tags für bessere Organisation
  tags: [{
    type: String,
    trim: true,
    maxlength: 30
  }],
  
  // Projekt-Fortschritt (nur für Admin sichtbar)
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Zeitstempel
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// INDEXE für Performance und Datenschutz
projectSchema.index({ customerId: 1, isActive: 1 });
projectSchema.index({ assignedAdmin: 1, isActive: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ deadline: 1 });
projectSchema.index({ createdAt: -1 });

// VIRTUELLE FELDER
projectSchema.virtual('messagesCount', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'projectId',
  count: true
});

projectSchema.virtual('filesCount', {
  ref: 'ProjectFile',
  localField: '_id',
  foreignField: 'projectId',
  count: true
});

// MIDDLEWARE
projectSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// INSTANCE METHODS
projectSchema.methods.canUserAccess = function(user) {
  if (user.role === 'admin') {
    return this.assignedAdmin.toString() === user._id.toString();
  }
  if (user.role === 'kunde') {
    return this.customerId.toString() === user._id.toString();
  }
  return false;
};

projectSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  this.updatedAt = new Date();
  return this.save();
};

// STATIC METHODS
projectSchema.statics.findByUser = function(user) {
  if (user.role === 'admin') {
    return this.find({ 
      assignedAdmin: user._id, 
      isActive: true 
    }).populate('customerId', 'firstName lastName email company');
  }
  
  if (user.role === 'kunde') {
    return this.find({ 
      customerId: user._id, 
      isActive: true 
    }).populate('assignedAdmin', 'firstName lastName email');
  }
  
  return [];
};

projectSchema.statics.findActiveProjects = function(user) {
  const baseQuery = this.findByUser(user);
  return baseQuery.where('status').in(['planning', 'inProgress', 'review']);
};

const Project = mongoose.model('Project', projectSchema);

// ✅ ESM-Export statt module.exports
export default Project;
