// API client for communicating with the backend
class ApiClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Teachers API
  async getTeachers(department) {
    const params = department ? `?department=${encodeURIComponent(department)}` : '';
    return this.request(`/teachers${params}`);
  }

  async getTeacher(id) {
    return this.request(`/teachers/${id}`);
  }

  async createTeacher(teacherData) {
    return this.request('/teachers', {
      method: 'POST',
      body: teacherData
    });
  }

  async updateTeacher(id, teacherData) {
    return this.request(`/teachers/${id}`, {
      method: 'PUT',
      body: teacherData
    });
  }

  async deleteTeacher(id) {
    return this.request(`/teachers/${id}`, {
      method: 'DELETE'
    });
  }

  async getTeacherWeeklyHours(id, department) {
    const params = department ? `?department=${encodeURIComponent(department)}` : '';
    return this.request(`/teachers/${id}/weekly-hours${params}`);
  }

  // Subjects API
  async getSubjects(department) {
    const params = department ? `?department=${encodeURIComponent(department)}` : '';
    return this.request(`/subjects${params}`);
  }

  async getSubject(id) {
    return this.request(`/subjects/${id}`);
  }

  async createSubject(subjectData) {
    return this.request('/subjects', {
      method: 'POST',
      body: subjectData
    });
  }

  async updateSubject(id, subjectData) {
    return this.request(`/subjects/${id}`, {
      method: 'PUT',
      body: subjectData
    });
  }

  async deleteSubject(id) {
    return this.request(`/subjects/${id}`, {
      method: 'DELETE'
    });
  }

  async bulkImportSubjects(text, department) {
    return this.request('/subjects/bulk-import', {
      method: 'POST',
      body: { text, department }
    });
  }

  async getSubjectsByTeacher(teacherId, department) {
    const params = department ? `?department=${encodeURIComponent(department)}` : '';
    return this.request(`/subjects/teacher/${teacherId}${params}`);
  }

  // Departments API
  async getDepartments() {
    return this.request('/departments');
  }

  async getDepartment(id) {
    return this.request(`/departments/${id}`);
  }

  async createDepartment(departmentData) {
    return this.request('/departments', {
      method: 'POST',
      body: departmentData
    });
  }

  async updateDepartment(id, departmentData) {
    return this.request(`/departments/${id}`, {
      method: 'PUT',
      body: departmentData
    });
  }

  async deleteDepartment(id) {
    return this.request(`/departments/${id}`, {
      method: 'DELETE'
    });
  }

  // Rooms API
  async getRooms(department) {
    const params = department ? `?department=${encodeURIComponent(department)}` : '';
    return this.request(`/rooms${params}`);
  }

  async getRoom(id) {
    return this.request(`/rooms/${id}`);
  }

  async createRoom(roomData) {
    return this.request('/rooms', {
      method: 'POST',
      body: roomData
    });
  }

  async updateRoom(id, roomData) {
    return this.request(`/rooms/${id}`, {
      method: 'PUT',
      body: roomData
    });
  }

  async deleteRoom(id) {
    return this.request(`/rooms/${id}`, {
      method: 'DELETE'
    });
  }

  async getRoomsByType(type, department) {
    const params = department ? `?department=${encodeURIComponent(department)}` : '';
    return this.request(`/rooms/type/${type}${params}`);
  }

  // Schedules API
  async getSchedules(department) {
    const params = department ? `?department=${encodeURIComponent(department)}` : '';
    return this.request(`/schedules${params}`);
  }

  async getScheduleByTeacher(teacherId, department) {
    const params = department ? `?department=${encodeURIComponent(department)}` : '';
    return this.request(`/schedules/teacher/${teacherId}${params}`);
  }

  async generateSchedule(department) {
    return this.request('/schedules/generate', {
      method: 'POST',
      body: { department }
    });
  }

  async deleteSchedules(department) {
    const params = department ? `?department=${encodeURIComponent(department)}` : '';
    return this.request(`/schedules${params}`, {
      method: 'DELETE'
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

// Create global API client instance
window.apiClient = new ApiClient();
