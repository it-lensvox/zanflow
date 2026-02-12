import React, { useState, useEffect } from 'react';
import { Upload, Edit2, X, Plus, Download, Lock, Mail, Building2, Briefcase } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth'
import { projectsApi, authApi } from '@/services/api';
import { useNavigate } from 'react-router-dom';

export function Profile() {
  const [userData, setUserData] = useState({
    jobTitle: 'Developer',
    department: 'Engineering',
    profileImage: null,
  });
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [tempSkills, setTempSkills] = useState<string[]>([]);

  // Fetch user skills on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await authApi.getMe();
        setTempSkills(userData.skills || []);
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await projectsApi.list();
        setProjects(response.results || []);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Handle profile image upload
  const handleProfileImageChange = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
    }
  };

  // Handle certificate upload 
  const handleCertificateUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      console.log('Certificate upload feature coming soon');
    }
  };

  // Handle certificate delete 
  const handleDeleteCertificate = (id: any) => {
    console.log('Certificate delete feature coming soon');
  };

  // Skills management
  const handleAddSkill = () => {
    if (newSkill.trim() && !tempSkills.includes(newSkill.trim())) {
      setTempSkills([...tempSkills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: any) => {
    setTempSkills(tempSkills.filter(skill => skill !== skillToRemove));
  };

 const handleSaveSkills = async () => {
  try {
    await authApi.updateSkills(tempSkills);
    const userData = await authApi.getMe();
    setTempSkills(userData.skills || []);
    setIsEditingSkills(false);
  } catch (error) {
    console.error("Failed to update skills:", error);
    alert("Failed to save skills. Please try again.");
  }
};
  const handleCancelEditSkills = async () => {
    try {
      const userData = await authApi.getMe();
      setTempSkills(userData.skills || []);
      setNewSkill('');
      setIsEditingSkills(false);
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
  };

  // Get initials for profile circle
  const getInitials = (name: any) => {
    return name.charAt(0).toUpperCase();
  };

  // Handle reset password
  const handleResetPassword = () => {
    alert('Password reset link has been sent to your email');
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto h-full">

        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-start space-x-6">
            {/* Profile Picture */}
            <div className="relative flex-shrink-0">
              <label htmlFor="profile-upload" className="cursor-pointer group">
                <div className="w-32 h-32 rounded-2xl bg-white shadow-md overflow-hidden flex items-center justify-center border-2 border-gray-100">
                  {userData.profileImage ? (
                    <img
                      src={userData.profileImage}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-indigo-300 to-purple-50 flex items-center justify-center text-gray-800 text-4xl font-bold">
                      {getInitials(user?.first_name)}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-2.5 shadow-lg group-hover:bg-indigo-700 transition">
                  <Upload className="w-5 h-5 text-gray-800" />
                </div>
              </label>
              <input
                id="profile-upload"
                type="file"
                accept="image/*"
                onChange={handleProfileImageChange}
                className="hidden"
              />
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{user?.first_name ? ` ${user.first_name}` : ''}</h1>
              <p className="text-lg text-gray-600 mb-4">{userData.jobTitle}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Department</p>
                    <p className="text-sm text-gray-900 font-semibold">{userData.department}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <Mail className="w-5 h-5 text-indigo-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 font-medium">Email</p>
                    <p className="text-sm text-gray-900 font-semibold truncate">{user?.email}</p>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/resetPassword')}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 text-gray-800 rounded-xl hover:bg-indigo-700 transition shadow-sm"
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-2 mb-5">
              <Briefcase className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Enrolled Projects</h2>
            </div>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-gray-500 animate-pulse">Loading projects...</p>
              ) : projects.length > 0 ? (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl text-gray-800 border border-indigo-100"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold">{project.name}</p>
                        {project.description && (
                          <p className="text-xs text-gray-600 mt-1">{project.description}</p>
                        )}
                      </div>
                      {project.project_settings?.priority && (
                        <span className="text-[10px] uppercase px-2 py-0.5 bg-white rounded-md border border-indigo-200">
                          {project.project_settings.priority}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic">No projects found.</p>
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
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 text-gray-800 text-sm font-medium rounded-xl hover:bg-indigo-700 transition shadow-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                ) : (
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveSkills}
                      className="px-4 py-2 bg-green-600 text-gray-800 text-sm font-medium rounded-xl hover:bg-green-700 transition"
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
                    className="px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-gray-800 text-sm font-medium rounded-xl hover:bg-indigo-700 transition flex items-center space-x-2"
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
                <label htmlFor="certificate-upload" className="cursor-pointer flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 text-gray-800 text-sm font-medium rounded-xl hover:bg-indigo-700 transition shadow-sm">
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                </label>
                <input
                  id="certificate-upload"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleCertificateUpload}
                  className="hidden"
                />
              </div>

              <div className="space-y-3">
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
    </div>
  );
};