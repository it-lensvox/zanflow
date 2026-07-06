import React, { useState, useEffect } from 'react';
import { Upload, Edit2, X, Plus, Download, Lock, Mail, Briefcase, ArrowRight, Loader2, Check, Pencil, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi, authApi } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { getProjectTypeColor } from '@/config/projectTypeConfig';

export function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Profile image
  const [profileImage, setProfileImage] = useState<string | null>((user as any)?.avatar || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Projects
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Skills
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [tempSkills, setTempSkills] = useState<string[]>([]);
  const [originalSkills, setOriginalSkills] = useState<string[]>([]);

  // Name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Fetch user skills on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const data = await authApi.getMe();
        setTempSkills(data.skills || []);
        setOriginalSkills(data.skills || []);
        if (data.avatar) {
          setProfileImage(data.avatar);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await projectsApi.list();
        const allProjects: any[] = Array.isArray(response)
          ? response
          : (response as any).results || [];
        const enrolled = allProjects.filter((project: any) =>
          project.members?.some((member: any) => member.user?.id === user?.id)
        );
        setProjects(enrolled);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) fetchProjects();
  }, [user?.id]);

  // Profile image 
  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const reader = new FileReader();
    reader.onloadend = () => setProfileImage(reader.result as string);
    reader.readAsDataURL(file);

    // Upload to S3 via backend
    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append('avatar', file);
    const updatedUser = await authApi.updateProfile(formData);
    if (updatedUser?.avatar) setProfileImage(updatedUser.avatar);
    setIsUploadingAvatar(false);
  };

  // Certificate upload
  const handleCertificateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !tempSkills.includes(newSkill.trim())) {
      setTempSkills([...tempSkills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setTempSkills(tempSkills.filter((s) => s !== skillToRemove));
  };

  const handleSaveSkills = async () => {
    try {
      // Auto-include whatever is currently typed without requiring "Add" click
      const skillsToSave =
        newSkill.trim() && !tempSkills.includes(newSkill.trim())
          ? [...tempSkills, newSkill.trim()]
          : tempSkills;
      await authApi.updateSkills(skillsToSave);
      const data = await authApi.getMe();
      setTempSkills(data.skills || []);
      setOriginalSkills(data.skills || []);
      setNewSkill('');
      setIsEditingSkills(false);
    } catch (error) {
      console.error('Failed to update skills:', error);
      alert('Failed to save skills. Please try again.');
    }
  };

  const handleCancelEditSkills = () => {
    setTempSkills(originalSkills);
    setNewSkill('');
    setIsEditingSkills(false);
  };

  const canSaveSkills =
    !!newSkill.trim() ||
    JSON.stringify(tempSkills) !== JSON.stringify(originalSkills);

  const handleStartEditName = () => {
    setEditFirstName(user?.first_name || '');
    setEditLastName(user?.last_name || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!editFirstName.trim()) return;
    try {
      setIsSavingName(true);
      await authApi.updateProfile({
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
      });
      setIsEditingName(false);
      window.location.reload();
    } catch (error) {
      console.error('Failed to update name:', error);
      alert('Failed to save name. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditFirstName('');
    setEditLastName('');
  };
  const getInitials = (name?: string) => name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-[#F7F8FB] px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6 pb-8">
      {/* ── Inner Card Container ── */}
      <div className="flex flex-col flex-1 space-y-6">

        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-start space-x-6">
            {/* Profile Picture */}
            <div className="relative flex-shrink-0">
              <label htmlFor="profile-upload" className="cursor-pointer group">
                <div className="w-32 h-32 rounded-2xl bg-white shadow-md overflow-hidden flex items-center justify-center border-2 border-gray-100">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-indigo-300 to-purple-50 flex items-center justify-center text-gray-800 text-4xl font-bold">
                      {getInitials(user?.first_name)}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-2.5 shadow-lg group-hover:bg-indigo-100 transition">
                  <Upload className="w-5 h-5 text-gray-800" />
                </div>
              </label>
              <input id="profile-upload" type="file" accept="image/*" onChange={handleProfileImageChange} className="hidden" />
            </div>

            {/* User Info */}
            <div className="flex-1">

              {/* Editable Name */}
              {isEditingName ? (
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    placeholder="First name"
                    autoFocus
                    className="text-2xl font-bold text-gray-900 border-b-2 border-indigo-400 bg-transparent focus:outline-none w-36"
                  />
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    placeholder="Last name"
                    className="text-2xl font-bold text-gray-900 border-b-2 border-indigo-400 bg-transparent focus:outline-none w-36"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isSavingName || !editFirstName.trim()}
                    className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition"
                    title="Save name"
                  >
                    {isSavingName
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCancelEditName}
                    className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-4 group">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {user?.first_name || ''}{user?.last_name ? ` ${user.last_name}` : ''}
                  </h1>
                  <button
                    onClick={handleStartEditName}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    title="Edit name"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Info Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <BadgeCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Designation</p>
                    <p className="text-sm text-gray-900 font-semibold capitalize">{user?.role || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <Mail className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 font-medium">Email</p>
                    <p className="text-sm text-gray-900 font-semibold truncate">{user?.email}</p>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/resetPassword')}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 text-gray-800 rounded-xl hover:from-indigo-100 hover:to-purple-100 transition shadow-sm"
                >
                  <Lock className="w-4 h-4" />
                  <span className="font-medium">Reset Password</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Enrolled Projects */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col max-h-[520px]">
            <div className="flex items-center space-x-2 mb-5 shrink-0">
              <Briefcase className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Enrolled Projects</h2>
              {!loading && projects.length > 0 && (
                <span className="ml-auto text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {projects.length}
                </span>
              )}
            </div>

            <div
              className="space-y-3 overflow-y-auto flex-1 pr-1"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.scrollbarColor = '#c7d2fe transparent')}
              onMouseLeave={(e) => (e.currentTarget.style.scrollbarColor = 'transparent transparent')}
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  <p className="text-sm text-gray-400">Loading projects...</p>
                </div>
              ) : projects.length > 0 ? (
                projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="w-full text-left group px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 rounded-xl border border-indigo-100 hover:border-indigo-300 transition-all duration-150 hover:shadow-sm"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold text-white shrink-0 ${getProjectTypeColor(project.task_type)}`}>
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                        <p className="text-sm font-bold text-gray-900 truncate">{project.name}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-indigo-300 group-hover:text-indigo-600 transition-colors shrink-0 ml-2" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl mb-3">
                    <Briefcase className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Not enrolled in any projects</p>
                  <p className="text-xs text-gray-400 mt-1">Projects you're a member of will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* Skills & Certificates */}
          <div className="lg:col-span-2 space-y-6">

            {/* Skills Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Skills</h2>
                {!isEditingSkills ? (
                  <button
                    onClick={() => setIsEditingSkills(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 text-gray-800 text-sm font-medium rounded-xl hover:from-indigo-100 hover:to-purple-100 transition shadow-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                ) : (
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveSkills}
                      disabled={!canSaveSkills}
                      className={`px-4 py-2 text-sm font-medium rounded-xl transition ${canSaveSkills
                        ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEditSkills}
                      className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {isEditingSkills && (
                <div className="mb-5 flex space-x-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                    placeholder="Add new skill"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddSkill}
                    disabled={!newSkill.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-gray-800 text-sm font-medium rounded-xl hover:from-indigo-100 hover:to-purple-100 transition flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {tempSkills.map((skill, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-900 text-sm font-medium rounded-full border border-indigo-200"
                  >
                    <span>{skill}</span>
                    {isEditingSkills && (
                      <button
                        onClick={() => handleRemoveSkill(skill)}
                        className="hover:bg-indigo-200 rounded-full p-1 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Certificates Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Certificates</h2>
                <label htmlFor="certificate-upload" className="cursor-pointer flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 text-gray-800 text-sm font-medium rounded-xl hover:from-indigo-100 hover:to-purple-100 transition shadow-sm">
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                </label>
                <input id="certificate-upload" type="file" accept=".pdf,.doc,.docx" onChange={handleCertificateUpload} className="hidden" />
              </div>
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mb-3">
                  <Download className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">No certificates uploaded yet</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};