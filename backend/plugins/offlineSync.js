const { queueWrite } = require('../services/syncService');

function toPlain(value) {
    return value?.toObject ? value.toObject({ depopulate: true, versionKey: false }) : value;
}

function identity(doc) {
    const data = toPlain(doc);
    if (!data?.company || !(data.branch || data.sourceBranch || data.destinationBranch)) return null;
    return { data, company: data.company, branch: data.branch || data.sourceBranch || data.destinationBranch };
}

function enqueue({ doc, action, payload }) {
    const found = identity(doc);
    if (!found || !doc?._id) return Promise.resolve();
    if (doc.constructor.modelName === 'JournalEntry' && ['accounting_entry', 'receipt'].includes(found.data.source)) return Promise.resolve();
    return queueWrite({ company: found.company, branch: found.branch, action, entityType: doc.constructor.modelName, entityId: doc._id, payload: payload || found.data });
}

module.exports = function offlineSyncPlugin(schema) {
    schema.add({ syncRevision: { type: Number, default: 0, min: 0 } });
    schema.pre('save', function rememberSyncAction(next) {
        this.$locals.offlineSyncAction = this.isNew ? 'CREATE' : 'UPDATE';
        this.syncRevision = this.isNew ? Math.max(1, this.syncRevision || 0) : (this.syncRevision || 0) + 1;
        next();
    });
    schema.pre('findOneAndUpdate', async function incrementSyncRevision() {
        const update = this.getUpdate() || {};
        if (update.$set?.syncRevision !== undefined || update.syncRevision !== undefined) return;
        const current = await this.model.findOne(this.getQuery()).select('syncRevision').lean();
        if (!current) return;
        update.$set = { ...(update.$set || {}), syncRevision: (current.syncRevision || 0) + 1 };
        this.setUpdate(update);
    });
    schema.post('save', async function queueSavedDocument(doc) {
        await enqueue({ doc, action: doc.$locals.offlineSyncAction || 'UPDATE' });
    });
    schema.post('findOneAndUpdate', async function queueUpdatedDocument(doc) {
        if (!doc) return;
        const update = this.getUpdate() || {};
        const change = update.$set || update;
        const action = change.isActive === false ? 'DELETE' : 'UPDATE';
        await enqueue({ doc, action, payload: update });
    });
};
