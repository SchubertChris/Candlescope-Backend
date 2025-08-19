// models/Message/Message.js
// VOLLSTÄNDIGES MESSAGE MODEL - Löst senderId Index-Warning
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // Projekt-Zuordnung
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  
  // Sender-Informationen
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // KORRIGIERT: Kein zusätzlicher index: true (verhindert Duplikat-Warning)
  },
  senderRole: {
    type: String,
    enum: ['admin', 'kunde', 'mitarbeiter'],
    required: true
  },
  senderName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Empfänger-Informationen
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Nachrichteninhalt
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  messageType: {
    type: String,
    enum: ['text', 'file', 'image', 'system'],
    default: 'text'
  },
  
  // Status-Tracking
  isRead: {
    type: Boolean,
    default: false
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Antworten/Threading
  parentMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  hasReplies: {
    type: Boolean,
    default: false
  },
  
  // Anhänge
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  hasAttachment: {
    type: Boolean,
    default: false
  },
  
  // Priorität und Markierungen
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  isImportant: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Meta-Daten
  isActive: {
    type: Boolean,
    default: true
  },
  editedAt: {
    type: Date
  },
  deletedAt: {
    type: Date
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
// INDEXES FÜR PERFORMANCE (KORRIGIERT: Explizite Indexes)
// ===========================
messageSchema.index({ senderId: 1 }); // Expliziter Index für senderId
messageSchema.index({ projectId: 1, createdAt: -1 });
messageSchema.index({ customerId: 1, isRead: 1 });
messageSchema.index({ parentMessageId: 1 });
messageSchema.index({ createdAt: -1 });

// ===========================
// VIRTUELLE FELDER
// ===========================
messageSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  if (hours > 0) return `vor ${hours} Stunde${hours > 1 ? 'n' : ''}`;
  if (minutes > 0) return `vor ${minutes} Minute${minutes > 1 ? 'n' : ''}`;
  return 'gerade eben';
});

messageSchema.virtual('isUnread').get(function() {
  return !this.isRead;
});

messageSchema.virtual('attachmentCount').get(function() {
  return this.attachments ? this.attachments.length : 0;
});

// ===========================
// INSTANCE METHODS
// ===========================
messageSchema.methods.canUserAccess = function(user) {
  if (user.role === 'admin') {
    return true; // Admin kann alle Nachrichten seines Projekts sehen
  }
  
  if (user.role === 'kunde') {
    return this.customerId.toString() === user._id.toString();
  }
  
  return false;
};

messageSchema.methods.markAsReadBy = async function(userId) {
  const alreadyRead = this.readBy.some(read => 
    read.userId.toString() === userId.toString()
  );
  
  if (!alreadyRead) {
    this.readBy.push({
      userId: userId,
      readAt: new Date()
    });
    
    this.isRead = true;
  }
  
  return this.save();
};

messageSchema.methods.addAttachment = function(fileData) {
  this.attachments.push({
    filename: fileData.filename,
    originalName: fileData.originalname,
    mimeType: fileData.mimetype,
    size: fileData.size,
    path: fileData.path
  });
  
  this.hasAttachment = this.attachments.length > 0;
  return this.save();
};

messageSchema.methods.reply = async function(replyData) {
  const Message = this.constructor;
  
  const reply = new Message({
    ...replyData,
    parentMessageId: this._id,
    projectId: this.projectId,
    customerId: this.customerId
  });
  
  await reply.save();
  
  this.hasReplies = true;
  await this.save();
  
  return reply;
};

// ===========================
// STATIC METHODS
// ===========================
messageSchema.statics.findByProject = function(projectId, user, limit = 50) {
  return this.find({ 
    projectId: projectId,
    isActive: true
  })
  .populate('senderId', 'firstName lastName email role avatar')
  .populate('projectId', 'name type')
  .sort({ createdAt: -1 })
  .limit(limit);
};

messageSchema.statics.findRecentByUser = function(user, limit = 20) {
  let query = { isActive: true };
  
  if (user.role === 'kunde') {
    query.customerId = user._id;
  }
  
  return this.find(query)
    .populate('senderId', 'firstName lastName email role avatar')
    .populate('projectId', 'name type')
    .sort({ createdAt: -1 })
    .limit(limit);
};

messageSchema.statics.getUnreadCount = function(userId, userRole) {
  let matchConditions = { 
    isActive: true,
    isRead: false
  };
  
  if (userRole === 'kunde') {
    matchConditions.customerId = userId;
  }
  
  return this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: null,
        unreadCount: { $sum: 1 }
      }
    }
  ]);
};

messageSchema.statics.markAllAsReadForUser = async function(userId, projectId = null) {
  let query = { 
    isRead: false,
    'readBy.userId': { $ne: userId }
  };
  
  if (projectId) {
    query.projectId = projectId;
  }
  
  const messages = await this.find(query);
  
  for (const message of messages) {
    await message.markAsReadBy(userId);
  }
  
  return messages.length;
};

messageSchema.statics.getConversationThread = function(parentMessageId) {
  return this.find({ parentMessageId: parentMessageId })
    .populate('senderId', 'firstName lastName email role avatar')
    .sort({ createdAt: 1 });
};

messageSchema.statics.createSystemMessage = function(projectId, customerId, content) {
  return this.create({
    projectId,
    customerId,
    senderId: null,
    senderRole: 'system',
    senderName: 'System',
    content,
    messageType: 'system',
    isRead: false
  });
};

// ===========================
// MIDDLEWARE
// ===========================
messageSchema.pre('save', function(next) {
  this.hasAttachment = this.attachments && this.attachments.length > 0;
  
  if (this.isModified('content') && !this.isNew) {
    this.editedAt = new Date();
  }
  
  next();
});

messageSchema.post('save', async function(doc) {
  try {
    const Project = mongoose.model('Project');
    await Project.findByIdAndUpdate(doc.projectId, {
      $inc: { messagesCount: 1 },
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Projekt-Counters:', error);
  }
});

export default mongoose.model('Message', messageSchema);