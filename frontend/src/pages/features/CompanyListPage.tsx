import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Company } from '@/types/features';
import { companyApi } from '@/api/features';
import { useActiveCompany } from '@/context/ActiveCompanyContext';
import CompanyFormModal from '@/components/features/CompanyFormModal';
import ConfirmDialog from '@/components/features/ConfirmDialog';

export default function CompanyListPage() {
  const navigate = useNavigate();
  const { setActiveCompany } = useActiveCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const data = await companyApi.getAll();
        setCompanies(data);
      } catch (error) {
        console.error('Failed to load companies:', error);
      }
    };
    loadCompanies();
  }, []);

  const activeCompany = useMemo(
    () => companies.find((c) => c.isActive),
    [companies]
  );

  const inactiveCompanies = useMemo(
    () => companies.filter((c) => !c.isActive),
    [companies]
  );

  const handleAddCompany = async (name: string) => {
    const company = await companyApi.create(name);
    setCompanies([...companies, company]);
  };

  const handleSelectCompany = (company: Company) => {
    setActiveCompany(company);
    navigate(`/features/companies/${company.id}`);
  };

  const handleSetActiveCompany = async (company: Company) => {
    try {
      const updated = await companyApi.setActive(company.id);
      setCompanies(
        companies.map((c) => ({ ...c, isActive: c.id === updated.id }))
      );
    } catch (error) {
      console.error('Failed to set active company:', error);
    }
  };

  const handleDeactivateCompany = async (company: Company) => {
    try {
      const updated = await companyApi.deactivate(company.id);
      setCompanies(companies.map((c) => (c.id === updated.id ? updated : c)));
    } catch (error) {
      console.error('Failed to deactivate company:', error);
    }
  };

  const handleStartEdit = (company: Company, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(company.id);
    setEditingName(company.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    try {
      const updated = await companyApi.update(editingId, editingName.trim());
      setCompanies(companies.map((c) => (c.id === updated.id ? updated : c)));
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update company:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await companyApi.delete(deleteTarget.id);
      setCompanies(companies.filter((c) => c.id !== deleteTarget.id));
    } catch (error) {
      console.error('Failed to delete company:', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ko-KR');

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-auto p-6" data-testid="company-list-container">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Companies</h1>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              + New Company
            </button>
          </div>

          {/* Active Company — Hero Card */}
          {activeCompany ? (
            <div
              onClick={() => handleSelectCompany(activeCompany)}
              className="mb-8 p-6 bg-white border-2 border-indigo-300 rounded-xl shadow-md
                         hover:shadow-lg cursor-pointer transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏢</span>
                  <div>
                    {editingId === activeCompany.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                          className="px-2 py-1 text-xl font-bold border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveEdit}
                          className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <h2 className="text-xl font-bold text-gray-800">
                        {activeCompany.name}
                      </h2>
                    )}
                    <p className="text-sm text-gray-500">
                      Created {formatDate(activeCompany.createdAt)}
                      {' · '}
                      {activeCompany.productCount} product{activeCompany.productCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 text-sm font-semibold bg-green-100 text-green-700 rounded-full">
                  Active
                </span>
              </div>

              <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => handleStartEdit(activeCompany, e)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition"
                >
                  Edit Name
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeactivateCompany(activeCompany);
                  }}
                  className="px-3 py-1 text-sm border border-yellow-300 text-yellow-700 rounded hover:bg-yellow-50 transition"
                >
                  Deactivate
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ id: activeCompany.id, name: activeCompany.name });
                  }}
                  className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-8 p-6 bg-white border-2 border-dashed border-gray-300 rounded-xl text-center">
              <p className="text-gray-500">
                No active company. Activate a company to get started.
              </p>
            </div>
          )}

          {/* Inactive Companies */}
          {inactiveCompanies.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Other Companies ({inactiveCompanies.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inactiveCompanies.map((company) => (
                  <div
                    key={company.id}
                    onClick={() => handleSelectCompany(company)}
                    className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md
                               cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      {editingId === company.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                            className="px-2 py-1 text-sm font-semibold border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveEdit}
                            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1 text-xs text-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <h4 className="font-semibold text-gray-700">{company.name}</h4>
                      )}
                      <span className="text-xs text-gray-400">
                        {company.productCount} product{company.productCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetActiveCompany(company);
                        }}
                        className="px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition"
                      >
                        Activate
                      </button>
                      <button
                        onClick={(e) => handleStartEdit(company, e)}
                        className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: company.id, name: company.name });
                        }}
                        className="px-2 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {companies.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                No companies yet. Click "+ New Company" to create one.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Company Modal */}
      <CompanyFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddCompany}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Company"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All products and test cases under this company will also be deleted.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
