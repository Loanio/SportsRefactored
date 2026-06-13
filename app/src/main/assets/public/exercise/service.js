import {
  ExerciseKind,
  SessionStatus,
  buildUploadPayload,
  canResume,
  createSession,
  finishSession,
  markExpired,
  nowIso
} from "./domain.js";

export class ExerciseService {
  constructor(repository, user) {
    this.repository = repository;
    this.user = user;
  }

  async loadDashboard() {
    const [events, instructions, summary, targets, runPlaces, client] = await Promise.all([
      this.repository.getExerciseEvents(),
      this.repository.getExerciseInstructions(),
      this.repository.getSemesterSummary(this.user.id),
      this.repository.getSemesterExerciseList(this.user.id),
      this.repository.getRunPlaces(),
      this.repository.judgeClientId({ userId: this.user.id, clientId: this.user.clientId })
    ]);

    const local = await this.getLocalUploadState();
    return {
      events,
      instructions,
      summary,
      targets,
      runPlaces,
      judgeClientId: client.judgeClientId,
      local
    };
  }

  async chooseEvent(event) {
    if (event.kind === ExerciseKind.RUN) {
      const places = await this.repository.getRunPlaces();
      const matchedPlaces = places.filter(place => place.exerciseEventId === event.id);
      return { type: "choose-run-place", event, places: matchedPlaces.length ? matchedPlaces : places };
    }

    const places = await this.repository.getExerciseLocationAreas(event.id);
    return { type: "choose-other-place", event, places };
  }

  async startSession(event, place) {
    const session = createSession({ event, place, user: this.user, startedAt: nowIso() });
    await this.repository.startSession?.(session);
    await this.repository.saveLocalSession(session);
    return session;
  }

  async finishCurrentSession(session, metrics) {
    const finished = finishSession(session, metrics);
    await this.repository.saveLocalSession(finished);
    return finished;
  }

  async uploadSession(session) {
    const payload = buildUploadPayload(session);
    const result = await this.repository.uploadSession(payload);
    if (result.ok) {
      await this.repository.removeLocalSession(session.kind, session.id);
      return { ...session, status: SessionStatus.SYNCED };
    }
    if (result.code === 2) await this.repository.removeLocalSession(session.kind, session.id);
    throw new Error(result.message || "上传失败");
  }

  async getLocalUploadState() {
    const [runRows, otherRows] = await Promise.all([
      this.repository.listLocalSessions(ExerciseKind.RUN),
      this.repository.listLocalSessions(ExerciseKind.OTHER)
    ]);
    return {
      run: runRows.map(row => markExpired(row)),
      other: otherRows.map(row => markExpired(row)),
      hasUnuploaded: runRows.length + otherRows.length > 0
    };
  }

  async continueSession(session) {
    if (!canResume(session)) {
      return { ...session, status: SessionStatus.EXPIRED };
    }
    const active = { ...session, status: SessionStatus.ACTIVE };
    await this.repository.saveLocalSession(active);
    return active;
  }

  async deleteSession(session) {
    await this.repository.removeLocalSession(session.kind, session.id);
  }

  async loadRecordCenter(params = {}) {
    const userId = params.userId || this.user.id;
    const [status, history, runCount, localUploaded] = await Promise.all([
      this.repository.getStatus(),
      this.repository.getHistoryList(userId),
      this.repository.getRunCountNum({ userId }),
      this.repository.judgeLocalUploaded({ userId, clientId: params.clientId || this.user.clientId })
    ]);
    return { status, history, runCount, localUploaded };
  }

  async loadHistorySummary(params = {}) {
    const userId = params.userId || this.user.id;
    const summary = await this.repository.getSemesterSummary(userId);
    const eventId = params.eventId || summary.eventResList?.[0]?.id || "";
    const termId = params.termId || "";
    const timeSummary = await this.repository.getTimeSummary(userId, eventId, termId);
    return { summary, timeSummary };
  }

  async loadExerciseStandard(params = {}) {
    const [targets, instructions, status] = await Promise.all([
      this.repository.getSemesterExerciseList(params.userId || this.user.id),
      this.repository.getExerciseInstructions(),
      this.repository.getStatus()
    ]);
    return { targets, instructions, status };
  }

  async loadVenueRuntime(params = {}) {
    const payload = {
      venueId: params.venueId || "",
      eventId: params.eventId || "",
      exerciseLocationId: params.exerciseLocationId || ""
    };
    const [otherRange, runRange, checkPoint] = await Promise.all([
      this.repository.getPolygonsMarker(payload),
      this.repository.getRunPolygonsMarker(payload),
      this.repository.getCheckPoint(payload)
    ]);
    return { otherRange, runRange, checkPoint };
  }

  async loadRecordDetail(exerciseRecordId) {
    const [info, violations, uploaded] = await Promise.all([
      this.repository.getRunRecordInfo(exerciseRecordId),
      this.repository.getRunViolations(exerciseRecordId),
      this.repository.judgeUploaded({ exerciseRecordId })
    ]);
    return { info, violations, uploaded };
  }
}
