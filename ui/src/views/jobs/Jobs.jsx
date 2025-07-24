import React, { useEffect } from 'react';

import JobTable from '../../components/table/JobTable';
import { useSelector, useDispatch } from 'react-redux';
import { xhrDelete, xhrPut } from '../../services/xhr';
import { useHistory } from 'react-router-dom';
import ProcessingTimes from './ProcessingTimes';
import { Button, Toast } from '@douyinfe/semi-ui';
import { IconPlusCircle } from '@douyinfe/semi-icons';
import './Jobs.less';

export default function Jobs() {
  const jobs = useSelector((state) => state.jobs.jobs);
  const processingTimes = useSelector((state) => state.jobs.processingTimes);
  const history = useHistory();
  const dispatch = useDispatch();

  // Refresh processing times after each run
  React.useEffect(() => {
    let timeoutId;

    const scheduleNextRefresh = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Only schedule if we have processing times data
      if (!processingTimes?.lastRun || !processingTimes.interval) {
        return;
      }

      const nextRunTime = processingTimes.lastRun + processingTimes.interval * 60000;
      const refreshTime = nextRunTime + 5000; // 5 seconds after next run
      const msUntilRefresh = Math.max(0, refreshTime - Date.now());

      // Only schedule if the refresh time is in the future
      if (msUntilRefresh > 0) {
        timeoutId = setTimeout(() => {
          dispatch.jobs.getProcessingTimes();
        }, msUntilRefresh);
      }
    };
    scheduleNextRefresh();

    // Clean up when destroyed
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [dispatch, processingTimes]);

  const onJobRemoval = async (jobId) => {
    try {
      await xhrDelete('/api/jobs', { jobId });
      Toast.success('Job successfully remove');
      await dispatch.jobs.getJobs();
    } catch (error) {
      Toast.error(error);
    }
  };

  const onJobStatusChanged = async (jobId, status) => {
    try {
      await xhrPut(`/api/jobs/${jobId}/status`, { status });
      Toast.success('Job status successfully changed');
      await dispatch.jobs.getJobs();
    } catch (error) {
      Toast.error(error);
    }
  };

  return (
    <div>
      <div>
        {processingTimes != null && <ProcessingTimes processingTimes={processingTimes} />}
        <Button
          type="primary"
          icon={<IconPlusCircle />}
          className="jobs__newButton"
          onClick={() => history.push('/jobs/new')}
        >
          New Job
        </Button>
      </div>

      <JobTable
        jobs={jobs || []}
        onJobRemoval={onJobRemoval}
        onJobStatusChanged={onJobStatusChanged}
        onJobInsight={(jobId) => history.push(`/jobs/insights/${jobId}`)}
        onJobEdit={(jobId) => history.push(`/jobs/edit/${jobId}`)}
      />
    </div>
  );
}
